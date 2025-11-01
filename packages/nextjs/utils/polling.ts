export async function pollWithTimeout<T>(
  pollFn: () => Promise<T>,
  checkCondition: (result: T) => boolean,
  interval: number = 5000,
  timeout: number = 300000, // 5 minutes
): Promise<T> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await pollFn();
    
    if (checkCondition(result)) {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error("Polling timeout exceeded");
}

export const exponentialBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};