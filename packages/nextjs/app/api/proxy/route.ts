import { NextRequest, NextResponse } from 'next/server';

const PAYCREST_API = 'https://api.paycrest.io/v1';
const LAYERSWAP_API = 'https://api.layerswap.io/api/v2';

export async function GET(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get('endpoint');
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    let baseUrl = '';
    let apiKey = '';

    if (endpoint.startsWith('/currencies') || endpoint.startsWith('/institutions') || endpoint.startsWith('/rates')|| endpoint.startsWith('/sender')) {
      baseUrl = PAYCREST_API;
      apiKey = process.env.NEXT_PUBLIC_PAYCREST_API_KEY || '';
    } else if (endpoint.startsWith('/swaps')) {
      baseUrl = LAYERSWAP_API;
      apiKey = process.env.NEXT_PUBLIC_LAYERSWAP_API_KEY || '';
    } else {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey,
        'X-LS-APIKEY': apiKey,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const endpoint = request.nextUrl.searchParams.get('endpoint');
    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    const body = await request.json();

    let baseUrl = '';
    let apiKey = '';

    if (endpoint.startsWith('/verify-account') || endpoint.startsWith('/sender') ) {
      baseUrl = PAYCREST_API;
      apiKey = process.env.NEXT_PUBLIC_PAYCREST_API_KEY || '';
    } else if (endpoint.startsWith('/swaps')) {
      baseUrl = LAYERSWAP_API;
      apiKey = process.env.NEXT_PUBLIC_LAYERSWAP_API_KEY || '';
    } else {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey,
        'X-LS-APIKEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}