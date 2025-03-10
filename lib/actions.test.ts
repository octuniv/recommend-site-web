import {
  signUpAction,
  LoginAction,
  LogoutAction,
  FetchAllPosts,
  CreatePost,
  FetchPost,
  DeletePost,
  EditPost,
  DeleteUser,
} from "./actions";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { clearAuth } from "./authState";
import { mockPosts, server } from "../mocks/server";
import { http, HttpResponse } from "msw";
import { serverAddress } from "./util";
import { revalidatePath } from "next/cache";

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    })
  ),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("./authState", () => ({
  clearAuth: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("Actions Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signUpAction", () => {
    it("should handle successful sign-up", async () => {
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("nickname", "John");
      formData.append("email", "john@example.com");
      formData.append("password", "password123");

      server.use(
        http.post(`${serverAddress}/users`, () => {
          return HttpResponse.json({ success: true }, { status: 200 });
        })
      );

      const result = await signUpAction({}, formData);

      expect(result).not.toBeDefined();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle failed sign-up due to invalid fields", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("nickname", "");
      formData.append("email", "invalid-email");
      formData.append("password", "short");

      const result = await signUpAction({}, formData);

      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.nickname).toBeDefined();
      expect(result.errors?.email).toBeDefined();
      expect(result.errors?.password).toBeDefined();
      expect(result.message).toBe("Missing Fields. Failed to Sign Up.");
    });
  });

  describe("LoginAction", () => {
    it("should handle successful login", async () => {
      (cookies as jest.Mock).mockResolvedValue({
        set: jest.fn(),
      });

      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "password123");

      server.use(
        http.post(`${serverAddress}/auth/login`, () => {
          return HttpResponse.json(
            {
              access_token: "valid-access-token",
              refresh_token: "valid-refresh-token",
              name: "John Doe",
              nickname: "John",
              email: "john@example.com",
            },
            { status: 200 }
          );
        })
      );

      await LoginAction({}, formData);

      const cookieStore = await cookies();
      expect(cookieStore.set).toHaveBeenCalledWith(
        "access_token",
        "valid-access-token",
        expect.any(Object)
      );
      expect(cookieStore.set).toHaveBeenCalledWith(
        "refresh_token",
        "valid-refresh-token",
        expect.any(Object)
      );
      expect(cookieStore.set).toHaveBeenCalledWith(
        "name",
        "John Doe",
        expect.any(Object)
      );
      expect(cookieStore.set).toHaveBeenCalledWith(
        "nickname",
        "John",
        expect.any(Object)
      );
      expect(cookieStore.set).toHaveBeenCalledWith(
        "email",
        "john@example.com",
        expect.any(Object)
      );
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("should handle failed login due to invalid credentials", async () => {
      const formData = new FormData();
      formData.append("email", "invalid@example.com");
      formData.append("password", "wrong-password");

      server.use(
        http.post(`${serverAddress}/auth/login`, () => {
          return HttpResponse.json(
            { error: "Invalid credentials" },
            { status: 401 }
          );
        })
      );

      const result = await LoginAction({}, formData);

      expect(result.message).toBe("Invalid credentials");
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("LogoutAction", () => {
    it("should handle logout", async () => {
      await LogoutAction();

      expect(clearAuth).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(redirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("FetchAllPosts", () => {
    it("should fetch posts successfully", async () => {
      const posts = await FetchAllPosts();
      expect(posts).toEqual(mockPosts);
    });

    it("should throw an error when the response is not ok", async () => {
      server.use(
        http.get(`${serverAddress}/posts`, () => {
          return HttpResponse.json({ status: 500 }, { status: 500 });
        })
      );

      await FetchAllPosts();
      expect(notFound).toHaveBeenCalled();
    });

    it("should handle empty posts array", async () => {
      server.use(
        http.get(`${serverAddress}/posts`, () =>
          HttpResponse.json([], { status: 200 })
        )
      );

      const posts = await FetchAllPosts();
      expect(posts).toEqual([]);
    });
  });

  describe("FetchPost", () => {
    it("should fetch a post successfully", async () => {
      const postId = 1;
      const mockPost = {
        id: postId,
        title: "Post 1",
        content: "Content of Post 1",
        videoUrl: "https://example.com/video1",
        nickname: "UserA",
        createdAt: "2023-10-01T12:00:00Z",
        updatedAt: "2023-10-01T12:00:00Z",
      };

      server.use(
        http.get(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(mockPost, { status: 200 });
        })
      );

      const result = await FetchPost(postId);

      expect(result).toEqual(mockPost);
    });

    it("should handle not found error when the post does not exist", async () => {
      const postId = 999; // 존재하지 않는 게시물 ID

      server.use(
        http.get(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { error: "Post not found" },
            { status: 404 }
          );
        })
      );

      await FetchPost(postId);
      expect(notFound).toHaveBeenCalled();
    });

    it("should handle unexpected errors during the fetch", async () => {
      const postId = 1;

      server.use(
        http.get(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
          );
        })
      );

      await FetchPost(postId);
      expect(notFound).toHaveBeenCalled();
    });
  });

  describe("CreatePost", () => {
    it("should create a post successfully", async () => {
      const formData = new FormData();
      formData.append("title", "New Post");
      formData.append("content", "This is the content of the new post.");
      formData.append("videoUrl", "https://example.com/video");

      server.use(
        http.post(`${serverAddress}/posts`, () => {
          return HttpResponse.json({ success: true }, { status: 201 });
        })
      );

      (cookies as jest.Mock).mockResolvedValue({
        get: jest.fn((key: string) => {
          if (key === "access_token") return { value: "valid-access-token" };
          if (key === "refresh_token") return { value: "valid-refresh-token" };
          return undefined;
        }),
      });

      await CreatePost({}, formData);

      expect(redirect).toHaveBeenCalledWith("/posts");
    });

    it("should handle validation errors", async () => {
      const formData = new FormData();
      formData.append("title", "");
      formData.append("content", "");
      formData.append("videoUrl", "");

      const result = await CreatePost({}, formData);

      expect(result.errors?.title).toBeDefined();
      expect(result.errors?.content).toBeDefined();
      expect(result.message).toBe("Missing Fields. Failed to create posts.");
    });

    it("should handle unauthorized access", async () => {
      const formData = new FormData();
      formData.append("title", "New Post");
      formData.append("content", "This is the content of the new post.");
      formData.append("videoUrl", "https://example.com/video");

      server.use(
        http.post(`${serverAddress}/posts`, () => {
          return HttpResponse.json(
            { statusCode: 401, message: "Unauthorized" },
            { status: 401 }
          );
        })
      );

      await CreatePost({}, formData);

      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle unexpected errors", async () => {
      const formData = new FormData();
      formData.append("title", "New Post");
      formData.append("content", "This is the content of the new post.");
      formData.append("videoUrl", "https://example.com/video");

      server.use(
        http.post(`${serverAddress}/posts`, () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
          );
        })
      );

      const result = await CreatePost({}, formData);

      expect(result.message).toBe("Create post failed.");
    });
  });

  describe("DeletePost", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delete a post successfully and redirect to /posts", async () => {
      const postId = 1;

      // Mock the server response for a successful DELETE request
      server.use(
        http.delete(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { message: "Post deleted successfully." },
            { status: 200 }
          );
        })
      );

      await DeletePost(postId);

      // Verify revalidation and redirection
      expect(redirect).toHaveBeenCalledWith("/posts");
    });

    it("should handle unauthorized access during post deletion", async () => {
      const postId = 1;

      // Mock the server response for a 401 Unauthorized error
      server.use(
        http.delete(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { statusCode: 401, message: "Unauthorized" },
            { status: 401 }
          );
        })
      );

      await DeletePost(postId);

      // Verify logout and redirection to login page
      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle unexpected errors during post deletion", async () => {
      const postId = 1;

      // Mock the server response for a 500 Internal Server Error
      server.use(
        http.delete(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
          );
        })
      );

      await DeletePost(postId);

      // Verify logout and redirection to login page
      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle invalid post ID gracefully", async () => {
      const postId = 999; // Non-existent post ID

      // Mock the server response for a 404 Not Found error
      server.use(
        http.delete(`${serverAddress}/posts/${postId}`, () => {
          return HttpResponse.json(
            { error: "Post not found" },
            { status: 404 }
          );
        })
      );

      await DeletePost(postId);

      // Verify logout and redirection to login page
      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("EditPost", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should edit a post successfully", async () => {
      const formData = new FormData();
      formData.append("title", "Updated Title");
      formData.append("content", "Updated content");
      formData.append("videoUrl", "https://example.com/new-video");

      server.use(
        http.patch(`${serverAddress}/posts/1`, () => {
          return HttpResponse.json(
            {
              ...mockPosts[0],
              title: formData.get("title"),
              content: formData.get("content"),
              videoUrl: formData.get("videoUrl"),
            },
            { status: 200 }
          );
        })
      );

      (cookies as jest.Mock).mockResolvedValue({
        get: jest.fn((key: string) => {
          if (key === "access_token") return { value: "valid-access-token" };
          if (key === "refresh_token") return { value: "valid-refresh-token" };
          return undefined;
        }),
      });

      await EditPost(1, {}, formData);

      expect(redirect).toHaveBeenCalledWith("/posts");
    });

    it("should be able to omit videoUrl when empty", async () => {
      const formData = new FormData();
      formData.append("title", "Updated Title");
      formData.append("content", "Updated content");
      formData.append("videoUrl", "");

      interface CapturedBody {
        title: string;
        content: string;
        videoUrl?: string;
      }

      let capturedBody: CapturedBody = { title: "", content: "" };

      server.use(
        http.patch(`${serverAddress}/posts/1`, async ({ request }) => {
          capturedBody = (await request.json()) as CapturedBody;
          return HttpResponse.json(
            {
              ...mockPosts[0],
              title: formData.get("title"),
              content: formData.get("content"),
            },
            { status: 200 }
          );
        })
      );

      (cookies as jest.Mock).mockResolvedValue({
        get: jest.fn((key: string) => {
          if (key === "access_token") return { value: "valid-access-token" };
          if (key === "refresh_token") return { value: "valid-refresh-token" };
          return undefined;
        }),
      });

      await EditPost(1, {}, formData);

      expect(capturedBody).toEqual({
        title: "Updated Title",
        content: "Updated content",
      });
      expect(capturedBody.videoUrl).toBeUndefined();
      expect(redirect).toHaveBeenCalledWith("/posts");
    });

    it("should handle validation errors", async () => {
      const formData = new FormData();
      formData.append("title", "");
      formData.append("content", "Valid content");
      formData.append("videoUrl", "");

      const result = await EditPost(1, {}, formData);

      expect(result.errors?.title).toBeDefined();
      expect(result.message).toBe("Missing Fields. Failed to edit posts.");
    });

    it("should handle unauthorized access", async () => {
      const formData = new FormData();
      formData.append("title", "Updated Title");
      formData.append("content", "Updated content");
      formData.append("videoUrl", "");

      server.use(
        http.patch(`${serverAddress}/posts/1`, () => {
          return HttpResponse.json(
            { statusCode: 401, message: "Unauthorized" },
            { status: 401 }
          );
        })
      );

      await EditPost(1, {}, formData);

      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle server error", async () => {
      const formData = new FormData();
      formData.append("title", "Updated Title");
      formData.append("content", "Updated content");
      formData.append("videoUrl", "");

      server.use(
        http.patch(`${serverAddress}/posts/1`, () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
          );
        })
      );

      const result = await EditPost(1, {}, formData);

      expect(result.message).toBe("Edit post failed.");
    });
  });

  describe("DeleteUser", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delete a user successfully and redirect to /", async () => {
      // Mock the server response for a successful DELETE request
      server.use(
        http.delete(`${serverAddress}/users`, () => {
          return HttpResponse.json(
            { message: "Successfully deleted account" },
            { status: 200 }
          );
        })
      );

      await DeleteUser();

      // Validation of functions that run when successfully progressed
      expect(clearAuth).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(redirect).toHaveBeenCalledWith("/");
    });

    it("should handle unauthorized access during user deletion", async () => {
      // Mock the server response for a 401 Unauthorized error
      server.use(
        http.delete(`${serverAddress}/users`, () => {
          return HttpResponse.json(
            { statusCode: 401, message: "Unauthorized" },
            { status: 401 }
          );
        })
      );

      await DeleteUser();

      expect(clearAuth).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should handle unexpected errors during user deletion", async () => {
      // Mock the server response for a 500 Internal Server Error
      server.use(
        http.delete(`${serverAddress}/users`, () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
          );
        })
      );

      expect(DeleteUser()).rejects.toThrow();
    });
  });
});
