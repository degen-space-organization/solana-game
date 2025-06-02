




// load the server URL from the environment variables

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost';
// const SERVER_PORT = import.meta.env.VITE_SERVER_PORT || '4000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';



/**
 * Looks something like this:
 * http://localhost:4000/api/v1
 */
// const apiUrl = `${SERVER_URL}:${SERVER_PORT}/api/${API_VERSION}`; // this is for development
const apiUrl = `${SERVER_URL}/api/${API_VERSION}`; // this is for production

export default apiUrl;