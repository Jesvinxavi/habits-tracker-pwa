# Healthy Habits Tracker PWA

A modern, responsive habit tracking app built as a Progressive Web App (PWA).

## 🚀 Features
- ✅ Track daily habits
- 🏃‍♂️ **Fitness activity tracking** - Record workouts, set rest days
- 📊 Progress visualization
- 🌙 Dark/Light mode
- 📱 Works offline (PWA)
- 🎨 iOS-style design
- 📱 Responsive design
- ♿ Accessibility features

## 🏃‍♂️ Using the Fitness Page
The Fitness page allows you to:
- **Record Activities**: Log workouts with duration, intensity, and notes
- **Create Custom Activities**: Add your own exercises with categories and icons
- **Set Rest Days**: Mark days as rest days with the orange toggle
- **Search Activities**: Quickly find activities by name
- **View History**: See all recorded activities grouped by category

### Activity Categories
- 🏃‍♂️ Cardio (Running, Cycling, Swimming)
- 💪 Strength Training (Weightlifting, Bodyweight)
- 🧘‍♀️ Flexibility (Yoga, Stretching)
- ⚽ Sports (Basketball, Soccer, Tennis)
- 🏊‍♂️ Swimming
- 🚴‍♂️ Cycling
- 🧘‍♂️ Yoga
- 🎯 Other

## 🌐 Live Demo
[Access the app here](https://your-username.github.io/habits-tracker)

## 📱 Install as App
1. Open the live URL
2. Click 'Install' or 'Add to Home Screen'
3. Use like a native app!

## 🛠️ Built With
- HTML5, CSS3, JavaScript
- **Tailwind CSS** for styling (100% utility-first approach)
- Service Worker for PWA functionality
- LocalStorage for data persistence

## 🎨 Styling Architecture
This project uses a **pure Tailwind CSS approach** with no custom CSS overrides for utility classes. All spacing, colors, typography, and layout are handled through Tailwind utility classes. Custom CSS is reserved only for:
- Complex animations and transitions
- CSS custom properties (CSS variables)
- Component-specific styling that cannot be expressed with utilities
- Dynamic gradients and complex visual effects

### CSS Migration Status ✅
- **Phase 1-10**: Completed - All convertible utility overrides migrated to Tailwind
- **Remaining CSS**: Only essential component styling and CSS variables
- **Zero `!important` rules**: All utility-level overrides eliminated
- **View visibility**: Now handled by Tailwind `hidden`/`block` classes
- **Swipe containers**: Use `overflow-visible` for proper swipe behavior

## 🚀 Deploy Your Own
1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Your app will be live at `https://username.github.io/repository-name`

Built with ❤️ for better habit tracking! 