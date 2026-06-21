"""
Anki export endpoint — generates a .apkg file from flashcards using genanki.
"""
import genanki
import random
import tempfile
import os
from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List

router = APIRouter()


class CardItem(BaseModel):
    front: str
    back: str


class ExportRequest(BaseModel):
    deckName: str
    cards: List[CardItem]


@router.post("/anki")
async def export_anki(req: ExportRequest):
    """Generate an Anki .apkg deck from provided flashcards."""

    deck_id = random.randrange(1 << 30, 1 << 31)
    model_id = random.randrange(1 << 30, 1 << 31)

    model = genanki.Model(
        model_id,
        'NexLearn Card',
        fields=[
            {'name': 'Front'},
            {'name': 'Back'},
        ],
        templates=[{
            'name': 'Card 1',
            'qfmt': '''
                <div style="font-family:Inter,sans-serif;font-size:18px;text-align:center;padding:20px;">
                    {{Front}}
                </div>
            ''',
            'afmt': '''
                {{FrontSide}}
                <hr id=answer>
                <div style="font-family:Inter,sans-serif;font-size:16px;text-align:center;padding:20px;color:#6366f1;">
                    {{Back}}
                </div>
            ''',
        }]
    )

    deck = genanki.Deck(deck_id, req.deckName)

    for card in req.cards:
        note = genanki.Note(
            model=model,
            fields=[card.front, card.back]
        )
        deck.add_note(note)

    # Write to temp file
    tmp = tempfile.NamedTemporaryFile(suffix='.apkg', delete=False)
    tmp.close()
    genanki.Package(deck).write_to_file(tmp.name)

    safe_name = req.deckName.replace(' ', '_').replace('/', '_')

    return FileResponse(
        tmp.name,
        media_type='application/octet-stream',
        filename=f'{safe_name}.apkg',
        background=None
    )
