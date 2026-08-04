import { Router } from 'express';
import { config } from '../../config/env.js';

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const tenantId = config.ENTRA_TENANT_ID || process.env.VITE_ENTRA_TENANT_ID || config.OBO_TENANT_ID;
    const clientId = config.ENTRA_CLIENT_ID || config.OBO_CLIENT_ID || process.env.VITE_ENTRA_CLIENT_ID;
    const clientSecret = config.ENTRA_CLIENT_SECRET || config.OBO_CLIENT_SECRET;

    if (!tenantId || !clientId) {
      // Local development fallback when tenant/client ID are not set
      return res.json({
        success: true,
        token: `local-token-${Date.now()}`,
        user: {
          email: username,
          name: username.split('@')[0] || username,
          authProvider: 'Local Auth',
        },
      });
    }

    // ROPC Token Request to Tenant-Specific Microsoft Entra ID Endpoint
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      username: username,
      password: password,
      scope: 'openid profile email',
      grant_type: 'password',
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const tokenResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || data.error) {
      console.warn(`[Auth ROPC Failed] Error: ${data.error} | Description: ${data.error_description}`);

      // In local development mode, allow fallback for test/dev accounts or when ROPC fails
      if (
        config.NODE_ENV !== 'production' &&
        (username.includes('local') ||
          username.includes('admin') ||
          username.includes('test') ||
          username.includes('demo') ||
          data.error === 'invalid_grant')
      ) {
        return res.json({
          success: true,
          token: `local-token-${Date.now()}`,
          user: {
            email: username,
            name: username.split('@')[0] || username,
            authProvider: 'Local Auth (Dev Fallback)',
          },
        });
      }

      return res.status(401).json({
        message: data.error_description || 'Invalid email or password.',
      });
    }

    return res.json({
      success: true,
      access_token: data.access_token,
      id_token: data.id_token,
      expires_in: data.expires_in,
      user: {
        email: username,
        name: username.split('@')[0] || username,
        authProvider: 'Microsoft Entra ID',
      },
    });
  } catch (error) {
    next(error);
  }
});
