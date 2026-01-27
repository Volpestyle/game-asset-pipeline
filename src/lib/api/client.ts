type RequestOptions = RequestInit & {
  errorMessage?: string;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      if (data && typeof data === "object" && "error" in data) {
        const errorValue = data.error;
        if (typeof errorValue === "string" && errorValue.trim()) {
          return errorValue;
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  try {
    const text = await response.text();
    if (text.trim()) return text;
  } catch {
    // ignore text errors
  }
  return fallback;
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { errorMessage, ...fetchOptions } = options;
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const message = await readErrorMessage(response, errorMessage ?? "Request failed.");
    throw new Error(message);
  }
  return response.json();
}

export async function requestFormData<T>(
  url: string,
  formData: FormData,
  options: { method?: string; errorMessage?: string } = {}
): Promise<T> {
  return requestJson<T>(url, {
    method: options.method ?? "POST",
    body: formData,
    errorMessage: options.errorMessage,
  });
}
