import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

# One JSON file per character: data/<slug>.json
DATA_DIR = Path(__file__).resolve().parent / "data"


@dataclass(frozen=True)
class Move:
    """One row of the official frame data table of a character."""

    category: str  # normal, unique, special, super_art, throw or common
    order: int  # Position in the official frame data table
    name: str
    command: str  # Classic controls input

    # Frame data. Text fields keep the official wording ("D", "122*", "3 frame(s) after landing", "SA2*"...)
    startup: str
    active: str
    active_detail: str  # Active frames of each hit
    recovery: str
    on_hit: str
    on_block: str
    cancel: str

    damage: str
    combo_scaling: str
    drive_gain_hit: int | None
    drive_loss_block: int | None
    drive_loss_punish: int | None
    sa_gain: str
    properties: str
    notes: str


@dataclass(frozen=True)
class Character:
    name: str
    slug: str
    vitality: int
    moves: tuple[Move, ...]

    @classmethod
    def from_file(cls, path):
        data = json.loads(path.read_text(encoding="utf-8"))
        moves = tuple(Move(**move) for move in data.pop("moves"))
        return cls(**data, moves=moves)

    @classmethod
    def all(cls):
        return sorted(_load().values(), key=lambda character: character.name.casefold())

    @classmethod
    def get(cls, slug):
        return _load().get(slug)


@cache
def _load():
    """All characters by slug. The files are read once, at the first call."""
    characters = (Character.from_file(path) for path in DATA_DIR.glob("*.json"))
    return {character.slug: character for character in characters}
