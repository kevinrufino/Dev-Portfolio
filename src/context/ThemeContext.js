/**
 * Theme Context for managing application color theme
 *
 * Provides global theme state management for colors and styling
 * Supports theme switching and consistent color access
 *
 * @context
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import { colour } from '../styles/tokens.js';

// Action types for theme state management
export const THEME_ACTIONS = {
  SET_THEME: 'SET_THEME',
  TOGGLE_THEME: 'TOGGLE_THEME',
};

// Available themes
export const THEMES = {
  YELLOW_BLUE: {
    primary: colour.acid,
    secondary: colour.ultra,
    background: colour.acid,
    text: colour.ultra,
    name: 'Yellow Blue',
  },
  BLUE_YELLOW: {
    primary: colour.ultra,
    secondary: colour.acid,
    background: colour.ultra,
    text: colour.acid,
    name: 'Blue Yellow',
  },
};

// Initial theme state
const initialState = {
  currentTheme: THEMES.YELLOW_BLUE,
  isDarkMode: false,
};

// Reducer for theme state management
const themeReducer = (state, action) => {
  switch (action.type) {
    case THEME_ACTIONS.SET_THEME:
      return {
        ...state,
        currentTheme: action.payload,
      };
    case THEME_ACTIONS.TOGGLE_THEME:
      return {
        ...state,
        currentTheme:
          state.currentTheme === THEMES.YELLOW_BLUE
            ? THEMES.BLUE_YELLOW
            : THEMES.YELLOW_BLUE,
        isDarkMode: !state.isDarkMode,
      };
    default:
      return state;
  }
};

// Create context
const ThemeContext = createContext(null);

// Context provider component
export const ThemeProvider = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Action creators with useCallback to prevent infinite re-renders
  const setTheme = useCallback(theme => {
    dispatch({ type: THEME_ACTIONS.SET_THEME, payload: theme });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: THEME_ACTIONS.TOGGLE_THEME });
  }, []);

  const getThemeColors = useCallback(
    () => state.currentTheme,
    [state.currentTheme],
  );

  const value = {
    ...state,
    setTheme,
    toggleTheme,
    getThemeColors,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Custom hook for using theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ThemeContext;
