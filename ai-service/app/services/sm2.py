"""
SM-2 Spaced Repetition Algorithm
Rating scale:
  0 = Again  (complete blackout)
  1 = Hard   (correct with serious difficulty)
  2 = Good   (correct with some hesitation)
  3 = Easy   (perfect recall)
"""
from datetime import datetime, timedelta, timezone


def compute_sm2(
    ease_factor: float,
    interval: int,
    repetitions: int,
    rating: int   # 0-3
) -> dict:
    """
    Returns updated SM-2 values.
    """
    # Clamp rating
    rating = max(0, min(3, rating))

    if rating == 0:
        # Again — reset
        new_reps = 0
        new_interval = 1
        new_ef = max(1.3, ease_factor - 0.2)
    elif rating == 1:
        # Hard — don't advance, shrink interval slightly
        new_reps = max(0, repetitions - 1)
        new_interval = max(1, int(interval * 0.6))
        new_ef = max(1.3, ease_factor - 0.15)
    elif rating == 2:
        # Good — normal progression
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)
        new_ef = max(1.3, ease_factor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02))
    else:
        # Easy — accelerated progression
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 4
        elif new_reps == 2:
            new_interval = 8
        else:
            new_interval = round(interval * ease_factor * 1.3)
        new_ef = min(2.5, ease_factor + 0.15)

    next_review = datetime.now(timezone.utc) + timedelta(days=new_interval)

    return {
        "easeFactor": round(new_ef, 2),
        "interval": new_interval,
        "repetitions": new_reps,
        "nextReviewAt": next_review.isoformat()
    }
