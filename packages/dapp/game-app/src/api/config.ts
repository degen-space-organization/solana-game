




// load the server URL from the environment variables

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

/**
 * !important:
 * Include the port in the SERVER_URL if your server runs on a specific port please
 * 
 * Looks something like this:
 * http://localhost:4000/api/v1
 */
const apiUrl = `${SERVER_URL}/api/${API_VERSION}`; // this is for production

export default apiUrl;