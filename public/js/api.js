const api = {
  async request(method, url, body) {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !url.endsWith("/api/auth/me")) {
      window.location.href = "/login.html";
      throw new Error("Not authenticated");
    }

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      // Ignore JSON parse errors
    }

    if (!response.ok) {
      throw new Error((data && data.error) || `Request failed (${response.status})`);
    }

    return data;
  },

  get(url) {
    return this.request("GET", url);
  },
  post(url, body) {
    return this.request("POST", url, body);
  },
  put(url, body) {
    return this.request("PUT", url, body);
  },
  del(url) {
    return this.request("DELETE", url);
  },
};

async function requireCounselor() {
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return null;
    }

    return await response.json();
  } catch (error) {
    window.location.href = "/login.html";
    return null;
  }
}
