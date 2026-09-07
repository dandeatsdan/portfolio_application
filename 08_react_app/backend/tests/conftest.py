"""Allow API tests from the repository root without installing the backend."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "08_react_app"))
sys.path.insert(0, str(ROOT / "07_streamlit_app" / "src"))
