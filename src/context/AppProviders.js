/**
 * Combined Context Providers for the application
 *
 * Wraps all context providers in a single component
 * Provides global state management for cursor and theme
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Wrapped providers
 */

import React from 'react';
import PropTypes from 'prop-types';
import { CursorProvider } from './CursorContext.js';
import { ThemeProvider } from './ThemeContext.js';

/**
 * Combined context provider component
 *
 * This component wraps all the individual context providers
 * to provide global state management throughout the application
 */
const AppProviders = ({ children }) => {
  return (
    <CursorProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </CursorProvider>
  );
};

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppProviders;
