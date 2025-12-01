# Icon System Documentation

## Overview

GridGuesser uses a custom SVG-based icon system instead of emojis for better performance, accessibility, and consistent rendering across all browsers and platforms.

## Usage

Import and use the `Icon` component:

```tsx
import Icon from "@/components/Icon";

// Basic usage
<Icon name="gamepad" />

// With custom size
<Icon name="trophy" size={32} />

// With custom className (for colors, etc.)
<Icon name="target" size={24} className="text-red-500" />
```

## Available Icons

| Name | Description | Used For |
|------|-------------|----------|
| `gamepad` | Game controller | Loading/connecting state |
| `target` | Bullseye target | Opponent's grid header |
| `image` | Picture frame | Player's own grid header |
| `pointer` | Hand/cursor pointer | "Your turn" indicator |
| `clock` | Clock face | "Opponent's turn" indicator |
| `hourglass` | Hourglass timer | "Waiting" status |
| `alert` | Warning triangle | Disconnection alerts |
| `trophy` | Trophy cup | Win status |
| `sad` | Sad face | Lose status |
| `lightbulb` | Light bulb | Tips and hints |
| `clipboard` | Clipboard | Copy button |
| `check` | Checkmark | Copy confirmation |

## Adding New Icons

To add a new icon:

1. Open `components/Icon.tsx`
2. Add a new entry to the `icons` object:

```tsx
newicon: (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="your-svg-path-here" />
  </svg>
)
```

3. Use it in your component:
```tsx
<Icon name="newicon" size={24} />
```

## Design Guidelines

### When to Use Icons

✅ **DO use icons for:**
- Status indicators
- Action buttons
- Headers and titles
- Navigation elements
- Loading states

❌ **DON'T use icons for:**
- Decorative purposes only
- Content that requires text explanation
- Places where text would be clearer

### Sizing Guidelines

- **Small (14-16px)**: Inline text, small buttons
- **Medium (24px)**: Standard UI elements, headers
- **Large (32-48px)**: Status indicators, loading screens
- **Extra Large (64px+)**: Hero sections, empty states

### Color Guidelines

Use Tailwind CSS classes for consistent coloring:

```tsx
// Status colors
<Icon name="trophy" className="text-green-500" />  // Success
<Icon name="alert" className="text-red-500" />     // Error
<Icon name="clock" className="text-yellow-500" />  // Warning
<Icon name="gamepad" className="text-blue-500" />  // Info

// Interactive states
<Icon name="clipboard" className="hover:text-blue-600 transition-colors" />
```

## Benefits Over Emojis

1. **Consistency**: Same appearance across all browsers and operating systems
2. **Performance**: SVGs are lightweight and scalable
3. **Customization**: Easy to change colors, sizes, and styles with CSS
4. **Accessibility**: Better screen reader support with proper ARIA labels
5. **Professional**: More polished look for a production app

## Icon Source

Icons are based on the [Lucide](https://lucide.dev/) icon set, which provides:
- Clean, consistent design
- Optimized SVG paths
- MIT license (free for commercial use)

## Future Enhancements

Potential improvements for the icon system:

- [ ] Add animation support (spin, pulse, bounce)
- [ ] Create icon variants (filled, outlined, two-tone)
- [ ] Add more game-specific icons
- [ ] Implement icon caching for better performance
- [ ] Add TypeScript autocomplete for icon names

