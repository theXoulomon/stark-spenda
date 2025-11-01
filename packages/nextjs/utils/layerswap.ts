import { pollWithTimeout } from './polling';
import type { LayerSwapStatus, LayerSwapStatusResponse } from '../types/layerswap';
import axios from 'axios';

export async function pollLayerSwapStatus(
  swapId: string,
  onStatusChange?: (status: LayerSwapStatus) => void
): Promise<LayerSwapStatusResponse> {
  let lastStatus: LayerSwapStatus | null = null;

  const getSwapStatus = async () => {
    const response = await axios.get(`/api/proxy?endpoint=/swaps/${swapId}`);
    const data = response.data as LayerSwapStatusResponse;
    
    // Notify if status has changed
    if (onStatusChange && data.data.status !== lastStatus) {
      lastStatus = data.data.status;
      onStatusChange(data.data.status);
    }
    
    return data;
  };

  const isComplete = (result: LayerSwapStatusResponse) => {
    const finalStates: LayerSwapStatus[] = ['completed', 'failed', 'cancelled', 'expired'];
    return finalStates.includes(result.data.status);
  };

  // Poll every 5 seconds for up to 5 minutes
  return pollWithTimeout(
    getSwapStatus,
    isComplete,
    5000,    // 5 second interval
    300000   // 5 minute timeout
  );
}