"""Domain errors. Services raise them; main.py turns each into its HTTP status with
body {"detail": message}. Handlers never catch them.
"""


class AppError(Exception):
    status_code = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(AppError):
    status_code = 404


class Conflict(AppError):
    status_code = 409


class RuleViolation(AppError):
    status_code = 400


class GenerationFailed(AppError):
    status_code = 502


class GenerationTimeout(AppError):
    status_code = 504
