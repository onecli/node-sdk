export class OneCLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneCLIError";
  }
}

export class OneCLIRequestError extends Error {
  public readonly url: string;
  public readonly statusCode: number;

  constructor(
    message: string,
    requestData: { url: string; statusCode: number },
  ) {
    super(
      `[URL=${requestData.url}] [StatusCode=${requestData.statusCode}] ${message}`,
    );
    this.name = "OneCLIRequestError";
    this.url = requestData.url;
    this.statusCode = requestData.statusCode;
  }
}

export function toOneCLIError(error: unknown): OneCLIError | OneCLIRequestError {
  if (error instanceof OneCLIError || error instanceof OneCLIRequestError) {
    return error;
  }

  if (error instanceof Error) {
    return new OneCLIError(error.message);
  }

  return new OneCLIError(String(error));
}
