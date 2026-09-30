import './styles.css';

export const metadata = {
  title: 'Pippit Bridge',
  description: 'Private Pippit creative bridge for ChatGPT and Canva workflows',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
