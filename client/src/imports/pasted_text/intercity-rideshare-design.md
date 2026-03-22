Design a modern, clean, and scalable mobile app UI for an intercity ride-sharing platform similar to Uber, but focused on long-distance travel between cities.

The app connects two types of users:

1. Passengers – users who want to travel between cities.
2. Drivers – users who are already planning intercity trips and can offer available seats in their personal vehicles.

🎯 Core Concept:
This is NOT a taxi app. It is a cost-sharing platform where drivers post planned trips and passengers book available seats.

🎨 Design Style:

* Minimal, modern, and clean UI
* Soft shadows, rounded corners (12–16px radius)
* Neutral base colors (white/gray) with a primary accent (blue or green)
* Friendly and trustworthy look (similar to BlaBlaCar + Uber)
* Use clear icons and simple typography (SF Pro / Inter)

📱 Screens to Design:

1. Onboarding Screens (3 screens)

* App introduction (affordable intercity travel)
* How it works (Post ride / Book seat)
* Trust & safety message

2. Authentication

* Login / Signup (phone number + OTP)
* Optional Google sign-in

3. Home Screen

* Toggle: "Find a Ride" / "Offer a Ride"
* Search fields:

  * From city
  * To city
  * Date picker
* CTA button: “Search Rides”

4. Search Results Screen

* List of available rides
* Each card shows:

  * Driver name & rating
  * Car type
  * Departure time
  * Price per seat
  * Available seats
* Filter & sort options

5. Ride Details Screen

* Driver profile (photo, rating, reviews)
* Car details
* Route overview
* Rules/preferences (no smoking, luggage allowed)
* Seat selection
* Book button

6. Post a Ride (Driver Flow)

* Input:

  * From / To
  * Date & time
  * Price per seat
  * Number of seats available
* Add car details
* Publish ride button

7. Booking & Payment Screen

* Booking summary
* Seat count
* Total price
* Payment options (Cash / Digital wallet)

8. My Trips Screen

* Upcoming trips
* Past trips
* Tabs: Passenger / Driver

9. Chat Screen

* Simple in-app chat between passenger & driver

10. Profile Screen

* User info
* Ratings & reviews
* Ride history
* Logout

💡 UX Requirements:

* Keep flow very simple (max 2–3 taps to book a ride)
* Highlight affordability and trust
* Use cards for ride listings
* Clear CTAs (Search, Book, Offer Ride)

📐 Platform:

* Mobile-first (iOS + Android)
* Create reusable components (buttons, cards, inputs)

⚡ Bonus:

* Add map preview in ride details
* Add seat availability visual (like 3/4 seats filled)
* Include empty states (no rides found)

Design should be production-ready and suitable for MVP development.
