// lib/authState.test.ts
import { getAuthState, clearAuth, loginStatus } from "./authState";
import { cookies } from "next/headers";
import { server } from "../mocks/server";
import { http, HttpResponse } from "msw";
import { serverAddress } from "./util";

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "valid-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
      set: jest.fn(),
      delete: jest.fn(),
    })
  ),
}));

describe("AuthState Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return isAuthenticated: true when tokens are valid", async () => {
    // Arrange: 쿠키에 유효한 토큰을 설정
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "valid-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
    });

    // Mock API 응답을 성공으로 변경
    server.use(
      http.get(`${serverAddress}/auth/validate-token`, () => {
        return HttpResponse.json({ valid: true }, { status: 200 });
      })
    );

    // Act: 인증 상태 확인
    const authState = await getAuthState();

    // Assert: 인증 상태가 true여야 함
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.message).toBe("Success validation!");
  });

  it("should refresh tokens and return isAuthenticated: true when refresh token is valid", async () => {
    // Arrange: 쿠키에 유효한 토큰을 설정
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "expired-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
      set: jest.fn().mockImplementation(() => {}),
    });

    // Mock API 응답을 실패로 변경 (액세스 토큰 검증 실패)
    server.use(
      http.get(`${serverAddress}/auth/validate-token`, () => {
        return HttpResponse.json({ valid: false }, { status: 200 });
      }),
      http.post(`${serverAddress}/auth/refresh`, () => {
        return HttpResponse.json(
          {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          },
          { status: 200 }
        );
      })
    );

    // Act: 인증 상태 확인
    const authState = await getAuthState();
    const cookieStore = await cookies();

    // Assert: 인증 상태가 true여야 함 (리프레시 토큰으로 갱신 성공)
    expect(authState.isAuthenticated).toBe(true);

    // 쿠키가 새로 설정되었는지 확인
    expect(cookieStore.set).toHaveBeenCalledWith(
      "access_token",
      "new-access-token",
      expect.any(Object)
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "refresh_token",
      "new-refresh-token",
      expect.any(Object)
    );
  });

  it("should return isAuthenticated: false when tokens do not exist", async () => {
    // Arrange: 쿠키에 토큰이 없는 경우
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn(() => undefined),
    });

    // Act: 인증 상태 확인
    const authState = await getAuthState();

    // Assert: 인증 상태가 false여야 함
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.message).toBe("The token does not exist.");
  });

  it("should return isAuthenticated: false when token refresh fails", async () => {
    // Arrange: 쿠키에 유효한 토큰을 설정
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "expired-access-token" };
        if (key === "refresh_token") return { value: "expired-refresh-token" };
        return undefined;
      }),
    });
    server.use(
      http.get(`${serverAddress}/auth/validate-token`, () => {
        return HttpResponse.json({ valid: false }, { status: 200 });
      }),
      http.post(`${serverAddress}/auth/refresh`, () => {
        return HttpResponse.json({}, { status: 401 });
      })
    );

    const authState = await getAuthState();
    expect(authState.isAuthenticated).toBe(false);
    expect(authState.message).toBe("Refresh token expired or invalid.");
  });

  it("should refresh tokens when access_token is expired and cached state exists", async () => {
    // Arrange: 첫 번째 호출에서 캐싱된 상태를 설정
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "valid-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
      set: jest.fn(),
    });

    // Mock API 응답: 첫 번째 호출에서는 유효한 access_token
    server.use(
      http.get(`${serverAddress}/auth/validate-token`, () => {
        return HttpResponse.json({ valid: true }, { status: 200 });
      })
    );

    // Act: 첫 번째 호출 - 캐싱된 상태 생성
    const firstAuthState = await getAuthState();
    expect(firstAuthState.isAuthenticated).toBe(true);
    expect(firstAuthState.message).toBe("Success validation!");

    // Arrange: 두 번째 호출에서 access_token이 만료된 상황으로 변경
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "expired-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
      set: jest.fn(),
    });

    // Mock API 응답: 두 번째 호출에서는 access_token 검증 실패 및 refresh_token으로 재발급 성공
    server.use(
      http.get(`${serverAddress}/auth/validate-token`, () => {
        return HttpResponse.json({ valid: false }, { status: 200 });
      }),
      http.post(`${serverAddress}/auth/refresh`, () => {
        return HttpResponse.json(
          {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          },
          { status: 200 }
        );
      })
    );

    // Act: 두 번째 호출 - 캐싱된 상태를 무시하고 refresh_token으로 재발급 시도
    const secondAuthState = await getAuthState();
    const cookieStore = await cookies();

    // Assert: 인증 상태가 true여야 함 (리프레시 토큰으로 갱신 성공)
    expect(secondAuthState.isAuthenticated).toBe(true);
    expect(secondAuthState.message).toBe("Success validation!");

    // 쿠키가 새로 설정되었는지 확인
    expect(cookieStore.set).toHaveBeenCalledWith(
      "access_token",
      "new-access-token",
      expect.any(Object)
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "refresh_token",
      "new-refresh-token",
      expect.any(Object)
    );
  });

  it("should clear cached state and cookies when clearAuth is called", async () => {
    // Arrange: 초기 상태에서 유효한 토큰 설정
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((key: string) => {
        if (key === "access_token") return { value: "valid-access-token" };
        if (key === "refresh_token") return { value: "valid-refresh-token" };
        return undefined;
      }),
      delete: jest.fn(),
    });

    // 초기 인증 상태 확인
    const authState = await getAuthState();
    expect(authState.isAuthenticated).toBe(true);

    // Act: clearAuth 호출
    await clearAuth();

    // 쿠키가 삭제되었는지 확인
    const cookieStore = await cookies();
    expect(cookieStore.delete).toHaveBeenCalledWith("access_token");
    expect(cookieStore.delete).toHaveBeenCalledWith("refresh_token");
  });
});

describe("loginStatus", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it("should return true when access_token cookie exists", async () => {
    // Arrange: Mock cookies to return an access_token
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn((name) => {
        if (name === "access_token") {
          return { value: "valid-token" };
        }
        return null;
      }),
    });

    // Act: Call the loginStatus function
    const result = await loginStatus();

    // Assert: Verify the result is true
    expect(result).toBe(true);
  });

  it("should return false when access_token cookie does not exist", async () => {
    // Arrange: Mock cookies to return no access_token
    (cookies as jest.Mock).mockReturnValue({
      get: jest.fn(() => null), // No access_token cookie
    });

    // Act: Call the loginStatus function
    const result = await loginStatus();

    // Assert: Verify the result is false
    expect(result).toBe(false);
  });
});
