"""
Utility functions for handling media ratings
"""
from datetime import datetime
from sqlalchemy import func
from extensions import db
from models import Media, UserMediaRating, MediaInList

def get_or_create_media(tmdb_id, media_type):
    """Get existing media or create if it doesn't exist"""
    media = Media.query.filter_by(tmdb_id=tmdb_id, media_type=media_type).first()
    if not media:
        media = Media(tmdb_id=tmdb_id, media_type=media_type)
        db.session.add(media)
        db.session.flush()  # Get ID without committing
    return media

def get_or_create_user_rating(user_id, media_id):
    """Get existing rating or create a blank one"""
    rating = UserMediaRating.query.filter_by(
        user_id=user_id, media_id=media_id
    ).first()
    
    if not rating:
        rating = UserMediaRating(
            user_id=user_id,
            media_id=media_id,
            watch_status="not_watched",
            rating=None
        )
        db.session.add(rating)
        db.session.flush()  # Get ID without committing
    
    return rating

def update_user_rating(user_id, media_id, watch_status=None, rating=None):
    """Update a user's rating for a specific media item"""
    user_rating = get_or_create_user_rating(user_id, media_id)
    
    # If watch status is changing to anything other than 'completed',
    # automatically set rating to None
    if watch_status is not None:
        user_rating.watch_status = watch_status
        if watch_status != 'completed':
            user_rating.rating = None
    
    # Handle rating updates - rating parameter being None means explicitly set to null
    if rating is not None:
        # Only allow setting non-null ratings if the status is completed
        if user_rating.watch_status == 'completed':
            user_rating.rating = rating
    elif rating is None and watch_status is None:
        # If rating is explicitly passed as None/null and no watch_status change
        # This handles the case when a user clears the rating by backspacing
        user_rating.rating = None
    
    user_rating.updated_at = datetime.utcnow()
    return user_rating

def get_average_rating(media_id, list_id=None):
    """
    Get the average rating for a media item
    If list_id is provided, only include ratings from users with access to that list
    """
    if list_id:
        # Subquery to get users with access to this list (owner + shared users)
        query = db.session.query(
            func.avg(UserMediaRating.rating).label('avg_rating'),
            func.count(UserMediaRating.id).label('rating_count')
        ).filter(
            UserMediaRating.media_id == media_id,
            UserMediaRating.rating != None
        )
        
        # Join with a subquery for users with access to this list
        from models import MediaList, SharedList
        list_users = db.session.query(SharedList.user_id).filter(SharedList.list_id == list_id).subquery()
        list_owner = db.session.query(MediaList.owner_id).filter(MediaList.id == list_id).subquery()
        
        query = query.filter(
            db.or_(
                UserMediaRating.user_id.in_(list_users),
                UserMediaRating.user_id.in_(list_owner)
            )
        )
    else:
        # Get global average across all users
        query = db.session.query(
            func.avg(UserMediaRating.rating).label('avg_rating'),
            func.count(UserMediaRating.id).label('rating_count')
        ).filter(
            UserMediaRating.media_id == media_id,
            UserMediaRating.rating != None
        )
    
    result = query.first()
    avg_rating = float(result.avg_rating) if result.avg_rating else None
    count = result.rating_count
    
    return {'average': avg_rating, 'count': count}

def get_user_ratings_for_list(user_id, list_id):
    """Get a user's ratings for all media in a specific list"""
    ratings = db.session.query(
        UserMediaRating
    ).join(
        MediaInList, MediaInList.media_id == UserMediaRating.media_id
    ).filter(
        UserMediaRating.user_id == user_id,
        MediaInList.list_id == list_id
    ).all()
    
    return ratings

def get_all_ratings_for_media_in_list(list_id, media_id):
    """Get all user ratings for a specific media item in a list"""
    # Find users with access to the list
    from models import User, MediaList, SharedList
    
    # Get the list owner and shared users
    list_owner_id = db.session.query(MediaList.owner_id).filter(MediaList.id == list_id).scalar()
    shared_user_ids = db.session.query(SharedList.user_id).filter(SharedList.list_id == list_id).all()
    shared_user_ids = [user_id for (user_id,) in shared_user_ids]
    
    all_user_ids = [list_owner_id] + shared_user_ids
    
    # Get ratings from these users
    ratings = db.session.query(
        UserMediaRating, User.username
    ).join(
        User, User.id == UserMediaRating.user_id
    ).filter(
        UserMediaRating.media_id == media_id,
        UserMediaRating.user_id.in_(all_user_ids)
    ).all()
    
    return [
        {
            'rating': rating.rating,
            'watch_status': rating.watch_status,
            'user': {
                'id': rating.user_id,
                'username': username
            }
        }
        for rating, username in ratings
    ]