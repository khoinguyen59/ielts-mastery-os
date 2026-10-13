"""Vocabulary Data Model & Schema (Master 450 Academic Words)."""
from dataclasses import dataclass, field
from typing import List, Dict, Optional

@dataclass
class VocabItem:
    id: str                         # e.g., "#001"
    word: str                       # e.g., "abandon"
    pos: str                        # "v", "n", "adj", "adv"
    ipa: str = ""                   # "/əˈbændən/"
    meaning: str = ""               # "từ bỏ (nghĩa cốt lõi)"
    extended_meaning: str = ""      # "ruồng bỏ nơi chốn..."
    score: float = 1.0              # 1.0 to 7.0
    synonym: str = ""               # "desert = forsake = discard"
    paraphrase: str = ""            # alias for synonym
    antonym: str = ""               # "retain = maintain = keep"
    key_collocation: str = ""       # "abandon a plan, abandon hope"
    collocations: str = ""          # alias for key_collocation
    example: str = ""               # "They abandoned the sinking boat."
    lego_roots: str = ""            # "a- (away) + bandon (control)"
    word_family: List[Dict] = field(default_factory=list)
    nuance_50: str = ""             # Academic nuance notes
    derivatives: List[Dict] = field(default_factory=list)

    def to_dict(self) -> Dict:
        syn = self.synonym or self.paraphrase
        colloc = self.key_collocation or self.collocations
        wf = self.word_family if self.word_family else self.derivatives
        return {
            "id": self.id,
            "word": self.word,
            "pos": self.pos,
            "ipa": self.ipa,
            "meaning": self.meaning,
            "extended_meaning": self.extended_meaning,
            "score": self.score,
            "synonym": syn,
            "paraphrase": syn,
            "antonym": self.antonym,
            "key_collocation": colloc,
            "collocations": colloc,
            "example": self.example,
            "lego_roots": self.lego_roots,
            "word_family": wf,
            "nuance_50": self.nuance_50,
            "derivatives": wf
        }

