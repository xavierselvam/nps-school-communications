import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return false

      const dbUser = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name },
        create: { email: user.email, name: user.name },
      })

      await prisma.gmailAccount.upsert({
        where: { userId: dbUser.id },
        update: {
          email: user.email,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token ?? undefined,
          tokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : undefined,
        },
        create: {
          userId: dbUser.id,
          email: user.email,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token ?? undefined,
          tokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : undefined,
        },
      })

      return true
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        })
        if (dbUser) {
          (session.user as { id?: string }).id = dbUser.id
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}
