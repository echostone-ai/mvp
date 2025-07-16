# CSS/Tailwind Styling Rules

## CRITICAL: Prevent CSS Conflicts

This project uses **Tailwind CSS** as the primary styling system. Custom CSS should be used sparingly and with extreme caution to avoid conflicts.

## ❌ NEVER DO:
1. **Don't create custom CSS classes that override Tailwind utilities**
2. **Don't use generic class names** (like `.auth-card`, `.button`, `.container`)
3. **Don't add large blocks of custom CSS** without checking for Tailwind conflicts
4. **Don't use `!important`** to override Tailwind styles

## ✅ ALWAYS DO:
1. **Use Tailwind classes first** - check if the styling can be achieved with existing utilities
2. **Use component-specific prefixes** for custom CSS (e.g., `.voice-recorder-specific-style`)
3. **Test styling changes immediately** after implementation
4. **Use Tailwind's @apply directive** when creating custom components
5. **Scope custom CSS tightly** to specific components

## 🔧 Preferred Approach:

### Option 1: Pure Tailwind (Preferred)
```jsx
<div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
  <div className="max-w-md mx-auto pt-20 px-6">
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
      <h1 className="text-3xl font-bold text-white mb-4">Welcome Back</h1>
    </div>
  </div>
</div>
```

### Option 2: Tailwind with @apply (When needed)
```css
.login-card {
  @apply bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20;
}
```

### Option 3: Scoped Custom CSS (Last resort)
```css
/* Only when Tailwind can't achieve the effect */
.login-page-specific-animation {
  animation: loginFadeIn 0.5s ease-in-out;
}

@keyframes loginFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## 🚨 Before Adding Any CSS:
1. **Check if Tailwind can do it** - use Tailwind docs/IntelliSense
2. **Use specific class names** - prefix with component name
3. **Test immediately** - verify no conflicts
4. **Document the reason** - why custom CSS was necessary

## 🔍 Common Tailwind Solutions:
- **Gradients**: `bg-gradient-to-r from-purple-500 to-blue-500`
- **Glass effect**: `bg-white/10 backdrop-blur-lg`
- **Shadows**: `shadow-lg shadow-purple-500/25`
- **Animations**: `animate-pulse`, `animate-bounce`, `transition-all duration-300`
- **Responsive**: `sm:text-lg md:text-xl lg:text-2xl`
- **Hover effects**: `hover:bg-purple-600 hover:scale-105`

## 🛠️ Debugging CSS Conflicts:
1. **Use browser dev tools** to see which styles are being overridden
2. **Check CSS specificity** - Tailwind uses low specificity
3. **Look for `!important`** declarations causing issues
4. **Verify class names** aren't conflicting with existing styles

## 📝 When Custom CSS is Acceptable:
- Complex animations not available in Tailwind
- Very specific component styling that would require many Tailwind classes
- Third-party component integration
- Performance-critical styling

## 🎯 Goal:
**Keep styling predictable, maintainable, and conflict-free by defaulting to Tailwind's utility-first approach.**