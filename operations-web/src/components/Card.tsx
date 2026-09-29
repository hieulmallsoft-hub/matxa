import type { PropsWithChildren, ReactNode } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  headerAction?: ReactNode;
}

export function Card({ title, subtitle, icon, badge, children, headerAction }: PropsWithChildren<CardProps>) {
  return (
    <article className="card">
      <div className="card-header">
        <div className="card-title-group">
          {icon && <span className="card-icon">{icon}</span>}
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div>
          {badge}
          {headerAction}
        </div>
      </div>
      {children}
    </article>
  );
}
