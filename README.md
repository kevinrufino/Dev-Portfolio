# Kevin Rufino's Portfolio 2024

A modern, interactive portfolio website built with React 18, featuring dynamic animations, custom cursor effects, and responsive design. This repository is optimized for AI agent development and collaboration.

## 🚀 Features

- **Interactive Loading Screen**: Progressive component loading with visual feedback
- **Custom Cursor Effects**: Dynamic cursor that responds to different interactive elements
- **Animated Hero Section**: Eye-catching hero with Matter.js physics and P5.js canvas
- **Skills Marquee**: Continuous scrolling display of technical skills
- **Project Showcase**: Interactive project cards with detailed information
- **Responsive Design**: Fully responsive across all device sizes
- **Smooth Animations**: React Spring animations throughout the application

## 🛠️ Technology Stack

- **Frontend**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.7
- **Animations**: React Spring 9.7.5
- **Physics**: Matter.js 0.20.0
- **Canvas**: P5.js 1.11.0 with @p5-wrapper/react
- **Typography**: Typewriter Effect 2.21.0
- **Build Tool**: Create React App 5.0.1

## 🤖 AI Agent Guidelines

This repository is AI-native and agent-ready. When working with AI agents:

### Agent Permissions

- ✅ **Allowed**: Component creation/modification, styling updates, dependency management
- ✅ **Allowed**: Documentation updates, test creation, performance optimizations
- ❌ **Restricted**: Core architecture changes, dependency version downgrades, environment variable changes
- ❌ **Restricted**: Deleting critical files, modifying build configuration without review

### Agent Workflows

- Use the predefined Windsurf workflows in `.windsurf/workflows/`
- Follow the component naming conventions documented in `docs/component-standards.md`
- Run `npm test` before submitting any changes
- Use `npm run format` to ensure consistent code formatting

### Code Quality Standards

- All components must have JSDoc comments
- Maintain 90%+ test coverage for new code
- Follow ESLint rules (no warnings allowed)
- Use TypeScript for new components when possible

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/kevinrufino/2024-Portfolio.git
cd 2024-Portfolio

# Install dependencies
npm install

# Start development server
npm start
```

## 🚀 Available Scripts

### `npm start`

Runs the app in development mode on [http://localhost:3000](http://localhost:3000)

### `npm test`

Launches the test runner in interactive watch mode

### `npm run build`

Builds the app for production to the `build` folder

### `npm run format`

Formats code using Prettier

## 🧪 Testing

This project uses Jest and React Testing Library. Test files should be co-located with components or in the `src/__tests__` directory.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

## 📁 Project Structure

```
src/
├── components/          # Reusable React components
│   ├── Hero/           # Hero section components
│   ├── Intro/          # Introduction section
│   └── Projects/       # Project showcase
├── assets/             # Static assets (images, fonts)
├── constants.js        # Application constants
├── featureFlags.js     # Build-time feature toggles
├── App.js             # Main application component
└── index.js           # Application entry point
```

## 🎨 Customization

### Colors

- **Primary**: `#F1F43B` (Yellow)
- **Secondary**: `#3e3bf4` (Blue)

These colors are defined in `App.js` and can be easily customized.

### Components

Each component is self-contained and can be modified independently. See the documentation in the `docs/` folder for detailed component guides.

### Feature Flags

Heavier optional experiences are toggled in `src/featureFlags.js`. Each flag is a module const with
a matching `REACT_APP_*` build-time override, so flipping one needs no code change:

| Flag                       | Env var                       | Default | Effect                                                                 |
| -------------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------- |
| `ENABLE_SHADER_BACKGROUND` | `REACT_APP_SHADER_BACKGROUND` | `false` | Three.js/WebGL shader background. Off = flat `--acid` page background. |

To turn one on locally, add it to `.env.local` and restart the dev server:

```bash
REACT_APP_SHADER_BACKGROUND=true
```

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on contributing to this project, especially for AI agents.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Deployment

The application is optimized for deployment to platforms like:

- Netlify
- Vercel
- GitHub Pages
- AWS Amplify

For deployment instructions, see the [deployment guide](docs/deployment.md).

---

**Built with ❤️ by Kevin Rufino**
