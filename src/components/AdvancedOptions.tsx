import { createContext, useContext } from 'react';

// Components can also be embedded in the existing technical workspace.
export const AdvancedOptions = createContext(true);
export const useAdvancedOptions = () => useContext(AdvancedOptions);
