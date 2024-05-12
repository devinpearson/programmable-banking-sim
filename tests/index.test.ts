import request from 'supertest'
import { app } from '../src/app'

describe("Test the accounts", () => {
  test("It should response the accounts", async () => {
    const response = await request(app).get("/za/pb/v1/accounts");
    expect(response.statusCode).toBe(200);
  });
});