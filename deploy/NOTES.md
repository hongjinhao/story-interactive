# Self-hosting notes

What I learned deploying Story Interactive on an old laptop: the why behind each step in `deploy/README.md`, the gotchas I hit, and the concepts worth knowing as an engineer. Facts and prices are as of October 2026.

## 1. The architecture and why

```
browser → Vercel (static React build, CDN) ──/api/* rewrite──> Tailscale Funnel (public HTTPS)
                                                                   └──> old laptop "crypt" (Ubuntu Server)
                                                                          ├── uvicorn on 127.0.0.1:8000 (systemd)
                                                                          └── Postgres on 127.0.0.1:5432 (Docker)
```

- **Frontend on Vercel, not the laptop.** The CDN serves the page fast from anywhere. The page still loads when the laptop is down, and only small JSON goes through the tunnel.
- **A same-origin rewrite instead of CORS.** The browser only ever talks to `*.vercel.app`, and Vercel forwards `/api/*`. `api.ts` keeps using relative paths and FastAPI needs no CORS change. Vercel's proxy waits up to **120 s** for the first byte, which covers a 30 s LLM call. Netlify's proxy gives up at 26 s, and Cloudflare Pages `_redirects` can't proxy to another domain.
- **A tunnel instead of port forwarding.** Funnel makes an outgoing connection from the laptop, so no router ports are opened. That avoids problems with ISP-level NAT (CGNAT) and a changing home IP, keeps your home IP hidden, and adds HTTPS. Funnel serves only on ports 443, 8443 and 10000.
- **Everything binds to `127.0.0.1`.** Nothing on the laptop is reachable from the network except through Funnel (and SSH).
- **Two machines:** `jinhao` is the laptop I work on (Windows + WSL), and `crypt` is the server. Tailscale on `jinhao` is only for my own admin access from outside home. Visitors need nothing installed.

### Hosting options compared (Oct 2026)

| Option | Cost | Gotcha |
|---|---|---|
| Render free web service | $0 | Sleeps after 15 min idle, ~1 min cold start. Free Postgres is deleted after 30 + 14 days. |
| Neon free Postgres | $0, no card | 1 GB per project, 100 compute-hours a month. Sleeps after 5 min, wakes in a few hundred ms. |
| AWS EC2 "free tier" | Credits, not free hours | New accounts (since July 15, 2025) get $100–200 in credits, and the Free plan closes at 6 months. A public IPv4 address costs $0.005/h (~$3.65/month). A t3.micro with IP is ~$11/month in credits. |
| AWS Lightsail / DigitalOcean | $7 / $6 a month (1 GB) | Simplest paid always-on server. 512 MB plans are too small for Postgres + uvicorn. |
| Oracle Always Free | $0 | Arm allowance halved in June 2026 without notice. Idle instances are reclaimed, and creating one often fails with "out of capacity". |
| Fly.io, Koyeb, Railway | No usable free tier for new users | Fly costs a few dollars a month. Koyeb's free plan closed. Railway gives $1/month of credit. |
| API Gateway + Lambda | Free tier | 29 s integration timeout, so slow LLM calls get 504s. |
| Heroku | $5–7 a month | 30 s router timeout, and it can't be raised. |
| Old laptop + Funnel (this setup) | $0 | Only as reliable as home power and Wi-Fi. |

**The "industry standard" shape** is a Dockerised API on a managed container service (ECS Fargate or Cloud Run), managed Postgres (RDS or Cloud SQL), the single-page app on a CDN, and CI/CD from GitHub Actions. That's worth learning, but it's overkill for a demo.

**When an app calls a paid LLM API and has no logins, the biggest risk is the API bill, not hosting.** Every new story branch is a paid Grok call. Keep only a small prepaid balance on the key, and add per-IP and daily rate limits before sharing the link widely.

## 2. Before wiping Windows

**What to back up:**
- Everything personal is under `C:\Users\<me>\`: Desktop, Documents, Downloads, Pictures, `.ssh`, and code with unpushed commits.
- Forgotten items: browser passwords (turn on sync), WSL distros (`wsl --export`), game saves, licence keys.

**Device-bound secrets:**
- **Passkeys saved in Windows Hello** (Settings → Accounts → Passkeys) exist only on that machine. Add another way to sign in first.
- **The BitLocker recovery key** can be read while Windows still works: `(Get-BitLockerVolume -MountPoint C:).KeyProtector` in an admin PowerShell. Wiping the disk makes it irrelevant; it matters for dual boot.
- **1Password** has no backup codes. What matters is the **Emergency Kit** (the Secret Key).

**The Windows licence is a digital licence tied to the hardware**, not the Microsoft account. It's one per device, not unlimited. To reinstall later, use Microsoft's Media Creation Tool, choose "I don't have a product key" and pick the **same edition**; it reactivates automatically.

**Dual boot vs wipe:** only one OS runs at a time, so a dual-boot server is down whenever you're in Windows. Windows updates can also put Windows back first in the boot order, and the two systems disagree about the hardware clock (`timedatectl set-local-rtc 1` fixes that). For a dedicated server, wiping is simpler.

## 3. Installing Ubuntu Server

**USB installer:** use Rufus with the GPT partition scheme, UEFI target and "Write in ISO Image mode". This wipes the stick; 8 GB is enough.

**Booting from it:** on HP, tap **Esc** at power-on, then **F9** (boot menu) or **F10** (BIOS). F-keys usually work without Fn during boot. Easier options:
- from Windows: Settings → Recovery → Advanced startup → Use a device
- from Linux: `sudo systemctl reboot --firmware-setup` goes straight to the BIOS

**Installer choices that matter:**

| Screen | Choice | Why |
|---|---|---|
| Network | **Continue without network** if Wi-Fi or tethering hangs on DHCP | The installer's network setup can get stuck after one failed attempt. The install works fully offline, Wi-Fi packages are still installed, and the installed system shows real errors. |
| Storage | Entire disk, LVM, **no LUKS encryption** | Encryption asks for a passphrase at every boot, so the server would sit at a prompt after a power cut. |
| Server name | Lowercase, no personal info | It becomes the public `https://<name>.<tailnet>.ts.net`. |
| SSH | Install OpenSSH | You manage the server from another machine. |
| Featured snaps | **None** (not the Docker snap) | Install Docker from Docker's own repository, which works better with systemd and Compose. |

**After the install:**
- The default LVM layout gives `/` only 100 GB. Grow it to the whole disk with `sudo lvextend -r -l +100%FREE /dev/ubuntu-vg/ubuntu-lv`.
- Run `sudo apt full-upgrade` to apply the updates the offline install skipped.

**Server vs Desktop:** Ubuntu Server has no GUI by design. A server needs no browser; visitors use their own, and you use SSH or VS Code Remote-SSH. You can add a desktop later with `apt install ubuntu-desktop`, but it costs ~1.5 GB of RAM, brings NetworkManager, more update prompts and more services listening on the LAN, and **auto-suspends after ~15 min idle** unless you turn that off.

## 4. Networking on the server

**Wi-Fi without a desktop** is configured with netplan in `/etc/netplan/60-wifi.yaml` (spaces, not tabs):

```yaml
network:
  version: 2
  wifis:
    wlo1:
      dhcp4: true
      access-points:
        "EXACT-SSID":
          password: "..."
```

Then `sudo chmod 600` the file (it holds the password) and run `sudo netplan apply`. If it fails, `journalctl -u netplan-wpa-wlo1` shows the real Wi-Fi error. The network name must match exactly, including capitals and spaces.

- **A phone works as a temporary network cable.** With USB tethering on, it shows up as `usb0` (type "eth").
- **Reaching the server:**
  - at home: `ssh user@<LAN IP>` (find the IP with `ip a show wlo1`)
  - anywhere: `ssh user@<name>` over Tailscale, with **both** machines logged in to the same tailnet
  - if the name doesn't resolve in WSL, use the `100.x.y.z` address from `tailscale status`
- **`tailscale ssh` vs `ssh`:** Tailscale SSH needs `--ssh` on the server and an access-policy match (same account by default). Plain OpenSSH over the tailnet needs neither.
- **A Tailscale snap in WSL** uses its own socket path: `sudo tailscale --socket /var/snap/tailscale/common/socket/tailscaled.sock login`, and once `sudo tailscale ... set --operator=$USER`.

### Tailscale, tunnels and port forwarding

**Tailscale** is a private network of your own devices (a "tailnet") built on WireGuard.
- Each device gets a stable `100.x.y.z` address and a name.
- Tailscale's servers only coordinate: who's in the tailnet and their public keys.
- Traffic goes device-to-device, end-to-end encrypted. Both sides make outgoing connections and punch through their NATs. If a network blocks that, traffic falls back to Tailscale's relay servers (DERP), still encrypted.

| Feature | Who can reach the service | Use |
|---|---|---|
| Tailnet | Only my devices | `ssh hongj@crypt` from anywhere |
| Serve | Only my tailnet, over HTTPS | Private dashboards and internal tools |
| **Funnel** | Anyone on the internet | The public API that Vercel calls |

**How Funnel works:**

```
visitor/Vercel ──HTTPS──> crypt.<tailnet>.ts.net   (public DNS → Tailscale's Funnel servers, not my home IP)
                               ▼
                    Funnel relay ──back down the connection crypt already opened──> crypt
                                                                                    └─ tailscaled ends HTTPS (Let's Encrypt cert for ts.net)
                                                                                       and forwards plain HTTP to 127.0.0.1:8000
```

A **tunnel** means the inside machine dials out first, and outside traffic rides back in over that connection. No router rule is needed, and nothing at home listens for the public. Cloudflare Tunnel (needs your own domain) and ngrok work the same way.

**Port forwarding** is the opposite: a router rule sends `<home public IP>:443` to `192.168.x.x:8000`.

| | Port forwarding | Tunnel |
|---|---|---|
| Direction | Inbound to the router | Outbound from the server |
| Router config | One rule per port | None |
| ISP-level NAT (CGNAT, mobile networks) | Doesn't work: no public IP of your own | Works anywhere |
| Home IP changes | Breaks; needs dynamic DNS | Doesn't matter |
| HTTPS certificate | Set up and renew it yourself | Handled for you |
| Home IP | Public | Hidden behind the provider |
| Internet scanners | Hit the router and server directly | Only reach the one published port, through the relay |
| Speed | Direct | One extra hop |
| Depends on | Your ISP | The provider's uptime, bandwidth limits and terms |

**What a tunnel doesn't fix:** the app is still public. Funnel hides the network, not the API. Anyone can call `/api/*`, so rate limiting and a small LLM balance still matter. Funnel also has unpublished bandwidth limits, which is one more reason the static frontend lives on a CDN.

## 5. Keeping processes running

| How it's started | SSH disconnect | Reboot / power cut | Crash |
|---|---|---|---|
| Foreground in an SSH terminal | Killed | Down | Down |
| `tmux` (detached) | Survives | Down (tmux is gone) | Down |
| **systemd service** (`Restart=always`, `enable`) | Survives | Starts at boot | Restarted in 5 s |
| Docker container with `restart: unless-stopped` | Survives | Starts with Docker | Restarted |

**Anatomy of a systemd unit** (`deploy/story-backend.service`):
- `[Unit]` sets ordering (`After=network-online.target docker.service`).
- `[Service]` sets `User`, `WorkingDirectory`, `EnvironmentFile=.env`, an absolute-path `ExecStart`, `Restart=always` and `RestartSec=5`. The restart also covers "Postgres isn't up yet at boot".
- `[Install]` has `WantedBy=multi-user.target`, which is what "start at boot" means.

**Day-to-day commands:**

```bash
sudo systemctl daemon-reload            # after editing a unit file
sudo systemctl enable --now <svc>       # start now and at every boot
systemctl status <svc>                  # running? last log lines
journalctl -u <svc> -f                  # live logs (persist across restarts)
sudo systemctl restart <svc>            # after git pull / uv sync
```

**Production vs dev uvicorn:** no `--reload`, bind to `127.0.0.1`, and use `uv sync --frozen --no-dev` (the exact locked versions, without test tools).

## 6. Docker concepts

- **Container vs volume:** the container is the disposable server program. The **volume** (`pgdata`) holds the data files and outlives the container.
  - `docker compose down` deletes containers and keeps the data.
  - `down -v` also deletes the volume, which erases every story.
- **Where volumes live:** inside Docker's storage (`/var/lib/docker/volumes/<project>_pgdata/_data`), not in the repo. Copying the repo doesn't copy data; use `pg_dump` and restore.
- **The `docker` group only applies after you log in again.** "Permission denied ... docker.sock" right after `usermod -aG docker $USER` means you need to log out and back in. `groups` shows whether it applied.
- **Published ports bypass `ufw`.** A `5432:5432` mapping exposes Postgres to the network even with a firewall. Bind to `127.0.0.1:5432:5432`, or publish no port at all.
- `docker compose up -d db` starts only that service; `adminer` isn't needed on the server.

## 7. Hardware: power, lid, battery, disk

- **Lid:** Ubuntu suspends on lid close by default. Change that in `/etc/systemd/logind.conf.d/lid.conf` with `HandleLidSwitch=ignore`, plus the `ExternalPower` and `Docked` variants.
- **Battery:**
  - Kept at 100% around the clock, a battery wears faster and can swell.
  - Linux can cap charging only if `/sys/class/power_supply/BAT*/charge_control_end_threshold` exists. Otherwise, on HP, use the BIOS: **Adaptive Battery Optimizer** or **Battery Health Manager**.
  - Battery health is `energy_full / energy_full_design` (74% here). The battery also works as a backup supply for a few hours of idle server time.
- **BIOS "After Power Loss: Power On"**, where available, makes the laptop boot again when power returns.
- **Airflow:** use a hard, flat surface. Lid-closed laptops run warmer.

**The NVMe incident.** In the middle of `apt full-upgrade`, the laptop logged `Buffer I/O error on dev dm-0`, then `Aborting journal`, and the filesystem **was remounted read-only**. After that, every write and `dpkg` failed with `Input/output error`, and rerunning apt can't help until a reboot.
- **Likely cause:** the Samsung PM981 (`MZVLB512HBJQ`) SSD dropping off the bus after entering a deep power-saving state (APST), which happens under heavy writes. Windows drives it differently, which is why it ran fine there.
- **Fix:** add the kernel parameter `nvme_core.default_ps_max_latency_us=0` to `GRUB_CMDLINE_LINUX_DEFAULT`, run `sudo update-grub`, and reboot. Verify with `cat /sys/module/nvme_core/parameters/default_ps_max_latency_us`, which should print `0`.
- **If it happens again:** add `pcie_aspm=off` and check for an HP BIOS update.
- **Recovering a half-done upgrade:** `sudo dpkg --configure -a && sudo apt -f install && sudo apt full-upgrade`. If the boot stops at file-system errors, run `fsck -y` on the logical volume.
- **SSD health** with `smartctl -a /dev/nvme0`:
  - `Critical Warning 0x00` and `Media and Data Integrity Errors 0` mean healthy.
  - A large `Error Information Log Entries` count is common and harmless on Samsung drives; it counts rejected commands, not failures.
  - `Unsafe Shutdowns` counts power losses.
- **Monitoring:** `sudo dmesg | grep -iE "i/o error|controller is down"` should print nothing.

## 8. Security checklist

- No router ports opened. The app and Postgres listen only on `127.0.0.1`, and Funnel is the only public way in.
- `.env` holds `XAI_API_KEY` and is `chmod 600`. It is never committed, printed or logged.
- Use a strong login password, kept in the password manager. Every `sudo` asks for it.
- Ubuntu installs security updates by itself (unattended-upgrades) but doesn't reboot on its own.
- The Funnel URL is public and appears in `vercel.json`, so anyone can call the API. Rate limiting and a small prepaid LLM balance are the real protection.
- Keep a backup now and then: `docker compose exec -T db pg_dump -U app app > backup.sql`.
