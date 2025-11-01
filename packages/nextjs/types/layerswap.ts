export type LayerSwapStatus = 
  | 'user_transfer_pending'   // Initial state, waiting for user transfer
  | 'cancelled'              // User cancelled the swap
  | 'expired'               // Swap expired (4 days without action)
  | 'ls_transfer_pending'   // Transaction received, processing
  | 'completed'             // Successfully completed
  | 'failed';              // Failed to process

export interface LayerSwapStatusResponse {
  data: {
    id: string;
    status: LayerSwapStatus;
    created_date: string;
    updated_date: string;
    deposit_address?: string;
    destination_address: string;
    refuel_data?: any;
  };
}