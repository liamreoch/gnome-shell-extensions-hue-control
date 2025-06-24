// utils/session.js
import Soup from 'gi://Soup';

let session = null;

export function getSession() {
    if (!session)
        session = new Soup.Session();
    return session;
}

export function abortSession() {
    if (session) {
        session.abort();
        session = null;
    }
}
