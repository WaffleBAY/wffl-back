export interface JwtPayload {
  sub: string; // User ID
  walletAddress: string; // Ethereum address
}

export interface JwtPayloadWithRefreshToken extends JwtPayload {
  refreshToken: string;
}
