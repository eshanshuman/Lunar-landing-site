"""Make the pipeline modules importable however pytest is started (repo root or pipeline/)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
