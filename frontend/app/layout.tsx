import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Multi-Agent Code System",
  description:
    "Autonomous dual-agent AI coding platform — Coder & Judge agents, Docker sandbox execution, GitHub integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
