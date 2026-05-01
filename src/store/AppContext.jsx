import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext(null);

const initialState = {
  capturedFace: null,       // base64 image from webcam
  photos: [],               // matched photos from API
  selectedPhotos: [],       // photos added to cart
  editingPhoto: null,       // photo currently open in editor
  order: null,              // order details after payment
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CAPTURED_FACE':
      return { ...state, capturedFace: action.payload };
    case 'SET_PHOTOS':
      return { ...state, photos: action.payload };
    case 'TOGGLE_PHOTO': {
      const exists = state.selectedPhotos.some((p) => p.id === action.payload.id);
      return {
        ...state,
        selectedPhotos: exists
          ? state.selectedPhotos.filter((p) => p.id !== action.payload.id)
          : [...state.selectedPhotos, action.payload],
      };
    }
    case 'SET_EDITING_PHOTO':
      return { ...state, editingPhoto: action.payload };
    case 'SET_ORDER':
      return { ...state, order: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
