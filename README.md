# WhirlWatch

WhirlWatch is a collaborative platform designed for film and television enthusiasts. It allows users to create, share, and manage watchlists, track their viewing progress, and rate media. The project was built to offer a more interactive and personalised way for friends and groups to discover and decide what to watch next, moving beyond simple static lists.

## Project Components

WhirlWatch is structured with a clear separation between its backend API and a modern frontend application.

### Backend

The backend is a Flask API, handling all data persistence, user authentication and external service integrations. It's built with a modular design, using Flask Blueprints to organise different functional areas.

*   **Authentication & User Management**: Core user functionalities are managed here, including account registration, secure login with JWT (JSON Web Tokens), email verification and password reset flows. Rate limiting is implemented across these endpoints to prevent abuse.
*   **List Management**: This is where the collaborative magic happens. Users can create their own media lists, invite others to join via unique share codes, and manage who has access. The system tracks media items within these lists, allowing for individual user ratings and watch statuses, while also calculating average ratings across all list members.
*   **Media Integration**: The API acts as a proxy for The Movie Database (TMDB) API, enabling comprehensive search capabilities for films and TV series, and fetching detailed metadata for individual titles. This ensures the application always has up-to-date information on a vast library of media.
*   **Personalised Suggestions**: A key feature is the integration of a Large Language Model (LLM) to provide custom media recommendations. Users can submit natural language queries, and the LLM processes these to generate tailored suggestions, enhancing media discovery beyond traditional genre-based filtering.
*   **User Profiles & Activity Feeds**: Users can manage their profiles and view activity feeds. These feeds offer insights into their own viewing habits and ratings, as well as a collaborative feed showing what other members in their shared lists have been watching and rating.
*   **Admin Functionality**: A dedicated set of endpoints provides administrative capabilities, such as managing user privileges, ensuring the platform can be effectively moderated.
*   **API Documentation**: A self-documenting `/api` endpoint provides a machine-readable overview of all available routes, their methods, expected parameters, and authentication requirements, making it straightforward for the frontend (or any client) to interact with the API.

### Frontend

The frontend is a dynamic and responsive React application, providing an intuitive user interface for interacting with the WhirlWatch backend.

*   **Modern User Interface**: Built with React, the application offers a smooth and engaging experience. Styling is handled using Tailwind CSS, ensuring a consistent and modern aesthetic across the platform.
*   **Client-Side Routing**: Utilising `react-router-dom`, the application manages navigation efficiently. It includes protected routes, ensuring that sensitive areas like user dashboards and list management pages are only accessible to authenticated users, while public-only routes guide users through registration and login.
*   **Comprehensive Feature Set**: The frontend exposes all the rich functionality of the backend. Users can:
    *   Register and log in securely.
    *   Browse and search for movies and TV shows.
    *   Create, view, and manage their personal and shared media lists.
    *   Join existing lists using share codes.
    *   Update watch statuses and provide personal ratings for media items.
    *   Explore collaborative rankings and use a "roulette" feature for group viewing decisions.
    *   Generate personalised media suggestions using the LLM integration.
    *   Manage their profile and view activity feeds.
    *   Administrators have access to a dedicated admin panel.
*   **Global State Management**: React Context API is employed for efficient global state management, particularly for authentication, ensuring user session information is readily available throughout the application.

## Tech Stack

*   **Backend**: Python, Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Limiter, Requests, LLM (for suggestions).
*   **Frontend**: React.js, React Router, Tailwind CSS.
*   **Database**: SQLAlchemy (ORM), typically SQLite for development, with support for PostgreSQL/MySQL in production.
*   **External APIs**: The Movie Database (TMDB) API.

## Future Ideas

*   **Enhanced LLM Integration**: Further refine the LLM's ability to understand nuanced queries and provide even more contextually relevant suggestions.
*   **Notifications**: Implement real-time notifications for list updates, new shared media, or collaborator activity.
*   **Advanced Filtering**: Introduce more sophisticated filtering and sorting options for media within lists and search results.
*   **User-Generated Content**: Allow users to add custom media entries not found on TMDB.