import { AnalyticsTracker } from '../components/AnalyticsProvider';

export const metadata = {
  title: 'Trackpaw Next.js Demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsTracker>{children}</AnalyticsTracker>
      </body>
    </html>
  );
}
