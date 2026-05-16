import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext(null);

function loadDeviceConfig() {
  try {
    const raw = localStorage.getItem('deviceConfig');
    return raw ? JSON.parse(raw) : { unit: null, outlet: null, helpNumber: '' };
  } catch {
    return { unit: null, outlet: null, helpNumber: '' };
  }
}

const initialState = {
  capturedFace: null,       // base64 image from webcam
  photos: [],               // matched photos from API
  selectedPhotos: [],       // photos added to cart
  editingPhoto: null,       // photo currently open in editor
  order: null,              // order details after payment
  deviceConfig: loadDeviceConfig(), // persisted unit + outlet selection
  photoEdits: {},           // { [photoId]: { elements, filters, frame, dataUrl } }
  layoutEdits: {},          // { [frameId]: { slots, elements, dataUrl } }
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
    case 'SET_PHOTO_EDIT':
      return {
        ...state,
        photoEdits: { ...state.photoEdits, [action.payload.id]: action.payload.data },
      };
    case 'SET_LAYOUT_EDIT':
      return {
        ...state,
        layoutEdits: { ...state.layoutEdits, [action.payload.frameId]: action.payload },
      };
    case 'SET_DEVICE_CONFIG': {
      localStorage.setItem('deviceConfig', JSON.stringify(action.payload));
      return { ...state, deviceConfig: action.payload };
    }
    case 'RESET':
      return { ...initialState, deviceConfig: state.deviceConfig };
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
