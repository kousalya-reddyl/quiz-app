import toast, { Toaster } from 'react-hot-toast';

export const toastStyles = {
  success: {
    style: {
      background: '#10b981',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  },
  error: {
    style: {
      background: '#ef4444',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  },
};

export const notify = {
  success: (message) => toast.success(message, toastStyles.success),
  error: (message) => toast.error(message, toastStyles.error),
  loading: (message) => toast.loading(message, { duration: 2000 }),
};

export const ToastProvider = () => (
  <Toaster
    position="top-center"
    reverseOrder={false}
    gutter={8}
    toastOptions={{
      duration: 3000,
      style: {
        fontSize: '14px',
        borderRadius: '8px',
      },
    }}
  />
);

export default toast;
