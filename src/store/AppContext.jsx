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
  aiTransformUsed: false,   // 1 free AI transform per session
  aiJob: null,              // in-flight or ready AI job — survives navigation
  printAddon: null,         // { copies, photoIds, totalPrice, canSubmit } — decided on Cart, paid in the same checkout transaction
  // Scopes phone uploads to one customer. Lives here rather than in the editor
  // so it survives a trip to the cart and back, and it is regenerated on RESET
  // and on a new face scan — inheriting the previous customer's session id
  // would show their uploads to the next person at the kiosk.
  uploadSessionId: crypto.randomUUID(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CAPTURED_FACE':
      return { ...state, capturedFace: action.payload };
    case 'SET_PHOTOS':
      return { ...state, photos: action.payload, selectedPhotos: [], photoEdits: {}, layoutEdits: {}, aiTransformUsed: false, aiJob: null, printAddon: null, uploadSessionId: crypto.randomUUID() };
    case 'SET_PRINT_ADDON':
      return { ...state, printAddon: action.payload };
    case 'SET_AI_JOB':
      return { ...state, aiJob: action.payload };
    case 'ADD_AI_PHOTO': {
      // payload: { url } — adds AI-transformed photo as a new cart item (does not replace original)
      const aiPhoto = {
        id: crypto.randomUUID(),
        url: action.payload.url,
        proxyUrl: action.payload.url,
        thumbnail: action.payload.url, // filmstrip renders p.thumbnail
        price: action.payload.price ?? 0,
        filename: action.payload.filename ?? 'AI Photo',
        photo_id: action.payload.photoId ?? null, // real backend Photo id → checkout resolves it
        sourcePhotoId: action.payload.sourcePhotoId ?? null,
        isAiGenerated: true,
      };
      return {
        ...state,
        selectedPhotos: [...state.selectedPhotos, aiPhoto],
        aiTransformUsed: true,
      };
    }
    case 'ADD_COMPOSITE_PHOTO': {
      // payload: { url, photoId } — a frame/collage render added as a new free cart item.
      const composite = {
        id: crypto.randomUUID(),
        url: action.payload.url,
        proxyUrl: action.payload.url,
        thumbnail: action.payload.url,
        price: 0,                                  // free, like AI photos
        filename: action.payload.filename ?? 'Frame',
        photo_id: action.payload.photoId ?? null,  // real backend Photo id → checkout resolves it
        isComposite: true,
      };
      return {
        ...state,
        selectedPhotos: [...state.selectedPhotos, composite],
      };
    }
    case 'TOGGLE_PHOTO': {
      const exists = state.selectedPhotos.some((p) => p.id === action.payload.id);
      return {
        ...state,
        selectedPhotos: exists
          ? state.selectedPhotos.filter((p) => p.id !== action.payload.id)
          : [...state.selectedPhotos, action.payload],
        // Cart composition just changed — a chosen print addon may reference
        // a photo that's no longer (or now is) in the cart. Simplest safe
        // reset: clear it, customer re-checks the box if they still want prints.
        printAddon: null,
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
    case 'CLEAR_PHOTO_EDIT': {
      const next = { ...state.photoEdits };
      delete next[action.payload.id];
      return { ...state, photoEdits: next };
    }
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
      // Fresh session id, not initialState's — that object is built once at
      // module load, so reusing it would hand the next customer the previous
      // one's upload session.
      return { ...initialState, deviceConfig: state.deviceConfig, uploadSessionId: crypto.randomUUID() };
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
