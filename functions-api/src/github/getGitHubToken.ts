// functions-api/src/github/getGitHubToken.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * HTTP endpoint to retrieve GitHub access token for authenticated user
 * 
 * IMPORTANT: This function retrieves the GitHub OAuth token that was stored
 * during the authentication process. You need to store it in Firestore when
 * the user first logs in.
 */
export const getGitHubToken = onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Get the authorization token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get the GitHub access token from Firestore
    // We store it during the initial authentication
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const githubAccessToken = userData?.githubAccessToken;

    if (!githubAccessToken) {
      res.status(404).json({ 
        error: 'No GitHub access token found. Please re-authenticate with GitHub.' 
      });
      return;
    }

    // Return the access token
    res.status(200).json({
      access_token: githubAccessToken,
    });

  } catch (error: any) {
    console.error('Error getting GitHub token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});