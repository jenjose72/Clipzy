import os
import subprocess

cmd = ["daphne", "backend.asgi:application"]

subprocess.run(cmd)
