// frontend/src/app/api/trigger-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
let isFirebaseInitialized = false;

if (getApps().length === 0) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!privateKey || !projectId || !clientEmail) {
    console.warn('Firebase Admin SDK not configured - missing environment variables:', {
      hasPrivateKey: !!privateKey,
      hasProjectId: !!projectId,  
      hasClientEmail: !!clientEmail
    });
  } else {
    try {
      // Handle different private key formats
      let processedPrivateKey = privateKey;
      
      // Remove quotes if present
      if (processedPrivateKey.startsWith('"') && processedPrivateKey.endsWith('"')) {
        processedPrivateKey = processedPrivateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
      processedPrivateKey = processedPrivateKey.replace(/\\n/g, '\n');
      
      // Ensure proper formatting
      if (!processedPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Invalid private key format - missing BEGIN marker');
      }
      
      console.log('🔑 Private key format check:', {
        hasBeginMarker: processedPrivateKey.includes('-----BEGIN PRIVATE KEY-----'),
        hasEndMarker: processedPrivateKey.includes('-----END PRIVATE KEY-----'),
        length: processedPrivateKey.length
      });

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: processedPrivateKey,
        }),
      });
      isFirebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', {
        message: error instanceof Error ? error.message : String(error),
        privateKeyLength: privateKey?.length || 0,
        privateKeyStart: privateKey?.substring(0, 50) || 'N/A'
      });
    }
  }
} else {
  isFirebaseInitialized = true;
}

function getDb() {
  if (!isFirebaseInitialized) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    // Check Firebase initialization first
    if (!isFirebaseInitialized) {
      console.error('❌ Firebase Admin SDK not initialized');
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK not initialized',
          message: 'Server configuration error - missing Firebase credentials'
        },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          }
        }
      );
    }

    const body = await request.json();
    const { repoFullName, jobType } = body;

    if (!repoFullName || !jobType) {
      return NextResponse.json(
        { error: 'repoFullName and jobType are required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          }
        }
      );
    }

    console.log('🚀 Triggering analysis for:', repoFullName, 'Type:', jobType);

    // Get Firestore instance safely
    const db = getDb();

    // Create an initial ingestion job using Firebase Admin SDK
    const jobData = {
      jobType,
      status: 'queued',
      repoFullName,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        triggeredBy: 'manual',
      },
    };

    const jobRef = await db.collection('jobs').add(jobData);
    
    console.log('Analysis job created:', {
      jobId: jobRef.id,
      repoFullName,
      jobType,
    });

    // Publish to queue for worker processing
    await db.collection('pubsubQueue').add({
      topic: 'analyze-repo',
      data: {
        jobId: jobRef.id,
        jobType,
        repoFullName,
      },
      published: false,
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        jobId: jobRef.id,
        message: 'Analysis job created successfully'
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('❌ Failed to trigger analysis:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      repoFullName: request.body ? 'present' : 'missing'
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}