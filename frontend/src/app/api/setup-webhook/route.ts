// frontend/src/app/api/setup-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

export async function POST(request: NextRequest) {
  let repoFullName: string | undefined;
  
  try {
    const body = await request.json();
    repoFullName = body.repoFullName;

    if (!repoFullName) {
      return NextResponse.json(
        { error: 'repoFullName is required' }, 
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

    console.log('Setting up webhook for:', repoFullName);

    // Parse owner/repo
    const [owner, repo] = repoFullName.split('/');
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Invalid repoFullName format. Expected: owner/repo' },
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

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Get GitHub credentials from environment
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_INSTALLATION_TOKEN;
    
    console.log('GitHub token available:', !!githubToken);
    console.log('Token prefix:', githubToken ? githubToken.substring(0, 10) + '...' : 'none');
    
    if (!githubToken) {
      console.warn('No GitHub token available, returning mock data');
      
      // Return mock data for development
      return NextResponse.json(
        {
          webhookId: `webhook_${Date.now()}`,
          webhookSecret,
          mock: true,
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          }
        }
      );
    }

    // Create Octokit client
    const octokit = new Octokit({
      auth: githubToken,
    });

    // Get current deployment URL from request headers (always accurate)
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const webhookUrl = `${protocol}://${host}/api/github-webhook`;

    console.log('Using webhook URL:', webhookUrl);

    // In development (localhost), return mock data since GitHub can't reach localhost
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      console.warn('⚠️ Running on localhost - GitHub webhooks cannot reach localhost URLs');
      console.warn('💡 To test webhooks, deploy to Vercel or use ngrok to expose your local server');
      
      return NextResponse.json(
        {
          webhookId: `webhook_dev_${Date.now()}`,
          webhookSecret,
          mock: true,
          note: 'Mock webhook (localhost)',
          warning: 'GitHub webhooks cannot reach localhost. Deploy to production or use ngrok for testing.',
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          }
        }
      );
    }

    try {
      // Create webhook on GitHub
      const webhook = await octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0',
        },
        events: ['pull_request', 'push'],
        active: true,
      });

      console.log('Webhook created successfully', {
        repoFullName,
        webhookId: webhook.data.id,
      });

      return NextResponse.json(
        {
          webhookId: webhook.data.id.toString(),
          webhookSecret,
          webhookUrl,
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          }
        }
      );

    } catch (error: any) {
      // Handle webhook already exists
      if (error.status === 422) {
        console.warn('Webhook already exists', { repoFullName });
        
        // Try to get existing webhooks
        try {
          const webhooks = await octokit.repos.listWebhooks({ owner, repo });
          const existingWebhook = webhooks.data.find(w => w.config.url === webhookUrl);
          
          if (existingWebhook) {
            return NextResponse.json(
              {
                webhookId: existingWebhook.id.toString(),
                webhookSecret: 'existing',
                note: 'Webhook already exists',
              },
              {
                headers: {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                }
              }
            );
          }
        } catch (listError) {
          console.error('Error listing webhooks:', listError);
        }
      }

      // Log detailed error info
      console.error('GitHub webhook creation error:', {
        status: error.status,
        message: error.message,
        response: error.response?.data,
      });

      throw error;
    }

  } catch (error: any) {
    console.error('Failed to setup webhook:', {
      repoFullName,
      error: error.message,
      status: error.status,
      stack: error.stack,
      response: error.response?.data,
    });

    return NextResponse.json(
      {
        error: 'Failed to setup webhook',
        message: error.message,
        details: error.response?.data || error.toString(),
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