# Deploy: backend on an Ubuntu laptop, frontend on Vercel

```
friends → Vercel (built React app) ──/api/* rewrite──> Tailscale Funnel (HTTPS)
                                                            └──> laptop: uvicorn 127.0.0.1:8000 → Postgres (docker, 127.0.0.1:5432)
```

Nothing listens on the internet except Funnel. No router ports are opened, and your home IP stays hidden.

## 1. Install Ubuntu Server (wipes the laptop)
Write the Ubuntu Server LTS ISO to a USB stick with Rufus (GPT, UEFI), boot from it, and pick:
- Storage: use an entire disk
- Server name: becomes your public API host, `https://<server-name>.<tailnet>.ts.net`
- Install OpenSSH server: yes
- Featured snaps: none (Docker comes from Docker's own repository below)

Then: `sudo apt update && sudo apt full-upgrade -y`

## 2. Keep the laptop awake with the lid closed
```bash
sudo mkdir -p /etc/systemd/logind.conf.d
printf '[Login]\nHandleLidSwitch=ignore\nHandleLidSwitchExternalPower=ignore\nHandleLidSwitchDocked=ignore\n' \
  | sudo tee /etc/systemd/logind.conf.d/lid.conf
```
It applies after the reboot in step 5. Ubuntu installs security updates by itself but does not reboot on its own.

## 3. Install Docker, uv and Tailscale
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER          # run docker without sudo (after logging in again)
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh                # open the printed link and log in
```
From now on you can manage the laptop from your main machine with `tailscale ssh <user>@<server-name>`.

## 4. Get the app and its secrets
```bash
git clone https://github.com/hongjinhao/story-interactive.git ~/story-interactive
cd ~/story-interactive
cp .env.example .env
nano .env        # paste XAI_API_KEY; keep the Postgres DATABASE_URL line
chmod 600 .env   # only your user can read the key
```
A private repo needs a GitHub login first (`gh auth login`, or a personal access token as the password).

## 5. Start Postgres and the backend
Log out and back in (for the docker group), then:
```bash
cd ~/story-interactive
docker compose up -d db                # only db; restart: unless-stopped brings it back after reboots
(cd backend && ~/.local/bin/uv sync --frozen --no-dev)
sed "s/YOURUSER/$USER/g" deploy/story-backend.service | sudo tee /etc/systemd/system/story-backend.service
sudo systemctl daemon-reload && sudo systemctl enable --now story-backend
curl http://127.0.0.1:8000/api/health  # expect the database to report ok
sudo reboot                            # applies the lid setting; check everything comes back on its own
```

## 6. Open it to the internet with Funnel
```bash
sudo tailscale funnel --bg 8000        # first time: open the printed link to allow Funnel for this tailnet
tailscale funnel status                # shows https://<server-name>.<tailnet>.ts.net
```
`--bg` keeps Funnel on across reboots. Check from your phone on mobile data: `https://<server-name>.<tailnet>.ts.net/api/health`.

## 7. Frontend on Vercel
1. Put the Funnel hostname into `frontend/vercel.json` (replace `YOUR-LAPTOP.YOUR-TAILNET.ts.net`), commit and push.
2. On vercel.com: Add New → Project → import the GitHub repo → Root Directory `frontend` → Deploy. Vercel detects Vite (`npm run build`, output `dist`).
3. Open the `.vercel.app` URL and start a story.

## Updating
```bash
cd ~/story-interactive && git pull
(cd backend && ~/.local/bin/uv sync --frozen --no-dev)
sudo systemctl restart story-backend
```
Schema edits need a database reset (`docker compose down -v && docker compose up -d db`), which deletes all stories.

## When something is wrong
```bash
systemctl status story-backend         # running? last few log lines
journalctl -u story-backend -f         # live backend logs
docker compose ps                      # is db up?
tailscale funnel status                # is Funnel on?
```

## Before posting the link publicly
Every new branch is a paid Grok call on your key. Keep only a small prepaid balance on it at console.x.ai, and add rate limiting before sharing widely.
