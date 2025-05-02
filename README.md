## Solving the Streaming Struggle: Whirlwatch

Let's be honest, we've all been there. You settle in for a cosy evening with your significant other, popcorn at the ready, only to be met with the dreaded question: "So, what shall we watch?" What follows is often a frustrating back-and-forth, scrolling endlessly through streaming services, debating genres, and ultimately wasting precious relaxation time. This was the spark that ignited the creation of **Whirlwatch**!

After countless evenings lost to the "what to watch" vortex, my girlfriend and I decided enough was enough. We needed a better way to manage our shared viewing preferences and make those all-important decisions without the usual hassle. The result? [Whirlwatch](https://whirlwatch.onrender.com/), a media tracker designed to streamline viewing choices and get to the good stuff faster.

###  Building a Solution: Focusing on the Backend Architecture

Whirlwatch goes beyond being a simple list app. Drawing inspiration from previous projects (though taking a decidedly different technical route than my [Premier Predictor app](https://atredshaw.github.io/posts/from-code-to-kickoff/)), my aim was to build a robust and feature-rich platform. While Premier Predictor utilised a hybrid Flask backend with Firebase BaaS, Whirlwatch leans into a dedicated Python backend, leveraging the capabilities of the TMDB API for comprehensive movie and show data.

This architectural shift allowed for a deeper focus on core backend functionalities. Key development considerations included:

*   **Secure User Authentication:**  Implementing email verification during sign-up was a priority to ensure legitimate users. A straightforward email-based password reset flow was also developed to handle forgotten passwords.
*   **Robust Session Management and Token Refresh:**  Ensuring a seamless user experience meant implementing secure session management with token refresh mechanisms to maintain user sessions without constant re-authentication.
*   **Comprehensive Account Management:**  Providing users with full control over their accounts was a key requirement.
*   **Implementing Rate Limiting:**  To maintain application stability and prevent abuse, rate limiting was integrated into the backend.

###  Crafting the Frontend: A Modern React Experience

On the frontend, the choice was React, styled using Tailwind CSS. This combination offered the flexibility and efficiency needed to build a dynamic and responsive user interface. Some key aspects of the frontend development included:

*   **Route Protection:** Implementing both public and private routes was crucial to secure sensitive areas of the application, ensuring only logged-in users could access them.
*   **Dynamic UI Updates:**  Focus was placed on creating a fluid user experience with dynamic updates and clear loading states to provide feedback during interactions.
*   **Responsive Design:**  Utilising Tailwind CSS facilitated the development of a modern and responsive UI that adapts well to different screen sizes.

###  Key Functionality:  Developing the Core Features

Whirlwatch incorporates several features designed to streamline the decision-making process for choosing what to watch:

*   **Media Search:** Integrating with the TMDB API allows users to easily search for movies and TV shows.
*   **List Creation and Management:**  Users can create and manage their own curated watchlists.
*   **Adding Media to Lists:**  A simple and intuitive process for adding searched media to user lists.
*   **List Filtering and Searching:**  Functionality to search and filter within lists, enabling users to quickly find specific titles or narrow down choices based on criteria like status or media type.
*   **List Sharing and Collaboration:**  Developing the ability to share lists with friends and join friends' lists to facilitate collaborative viewing decisions.
*   **Rating System:**  Implementing features for users to rate shows and view the overall ratings provided by other users.
*   **Progress Tracking:**  Visualising the status of media in lists, categorised as "Not Started," "In Progress," and "Watched."
*   **Personal Rating Overview:**  Providing users with a view of all the media they have personally rated.

###  The Roulette Wheel:  A Random Selection Mechanism

A central feature, directly addressing the initial problem of indecision, is the **Roulette Wheel**. This component allows users to filter by lists, statuses, and media types and then randomly selects an item to watch. This provides a fun and efficient way to overcome choice paralysis.

###  Future Considerations: Exploring LLMs for Recommendations

Towards the latter stages of development, I experimented with the potential of using Large Language Models (LLMs) via platforms like Groq and Cerebras to provide media recommendations. While not currently integrated, this exploration highlights a potential direction for future enhancements, offering personalised suggestions based on user preferences.

### Lessons Learned: Structuring Flask Endpoints for Scalability

One of the key takeaways from this project, and something I've actively explored in subsequent developments, revolves around the structure of Flask endpoints. Initially, all the endpoints were housed within a single large file. As the project grew, this monolithic structure became increasingly challenging to navigate and maintain.

Recognising this, I've since adopted a more modular approach, splitting Flask endpoints into multiple separate files based on their associated routes. For example, user authentication endpoints would reside in one file, media management endpoints in another, and so on.

This refactoring has yielded significant benefits in terms of code organisation and manageability. It becomes far easier to locate and modify specific endpoint logic when it's grouped logically by its function or the resource it operates on. This approach promotes cleaner code, reduces the cognitive load when working on different parts of the application, and ultimately contributes to a more scalable and maintainable codebase. This is a pattern I've found particularly effective in more recent projects, leading to a more streamlined and efficient development workflow.

### Wrapping Up: Reflecting on the Development Journey

Whirlwatch was born out of a personal frustration, but the process of building it provided valuable insights into various aspects of web development. From architecting the backend with Python to crafting a modern frontend with React, and even exploring the potential of LLMs, the journey was a rewarding one. The evolution in how I approach structuring Flask applications, particularly the move towards separating endpoints by route, stands out as a key lesson learned, shaping my development practices for future projects.

