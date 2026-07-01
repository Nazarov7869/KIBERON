// =====================================================================
//  APP SHELL — yuqori panel + rolga mos yon menyu
// =====================================================================
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../auth/AuthContext'

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  box: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5',
  file: 'M6 2h8l4 4v16H6zM14 2v4h4',
  truck: 'M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM18 19a2 2 0 100-4 2 2 0 000 4z',
  building: 'M4 21V4h10v17M14 21V9h6v12M7 8h2M7 12h2M7 16h2',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 11a3 3 0 000-6M22 20c0-2-1-4-4-4.5',
  sparkles: 'M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5zM18 14l.9 2.2L21 17l-2.1.8L18 20l-.9-2.2L15 17l2.1-.8z',
  shield: 'M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3zM9 12l2 2 4-4',
}

function Icon({ name }) {
  return (
    <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  )
}

const NAV = {
  super_admin: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { section: 'Bozor' },
    { to: '/pools', label: "Yig'ish bozori", icon: 'layers' },
    { to: '/orders', label: 'Buyurtmalar', icon: 'truck' },
    { to: '/quality', label: 'Sifat nazorati', icon: 'shield' },
    { section: 'Boshqaruv' },
    { to: '/companies', label: 'Korxonalar', icon: 'building' },
    { to: '/leads', label: 'Tashqi xaridorlar', icon: 'globe' },
    { to: '/staff', label: 'Xodimlar', icon: 'users' },
    { to: '/advisor', label: 'AI maslahatchi', icon: 'sparkles' },
  ],
  exporter: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { to: '/lots', label: 'Lotlarim', icon: 'box' },
    { to: '/pools', label: "Yig'ish bozori", icon: 'layers' },
    { to: '/rfqs', label: 'Talablar', icon: 'file' },
    { to: '/leads', label: 'Tashqi talab', icon: 'globe' },
    { to: '/orders', label: 'Buyurtmalar', icon: 'truck' },
    { to: '/advisor', label: 'AI maslahatchi', icon: 'sparkles' },
  ],
  importer: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { to: '/rfqs', label: "RFQ'larim", icon: 'file' },
    { to: '/pools', label: "Yig'ish bozori", icon: 'layers' },
    { to: '/orders', label: 'Buyurtmalar', icon: 'truck' },
    { to: '/advisor', label: 'AI maslahatchi', icon: 'sparkles' },
  ],
  logistics: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { to: '/orders', label: 'Buyurtmalar', icon: 'truck' },
  ],
  warehouse: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { to: '/quality', label: 'Sifat nazorati', icon: 'shield' },
    { to: '/pools', label: "Yig'ish bozori", icon: 'layers' },
  ],
  embassy: [
    { to: '/', label: 'Boshqaruv', icon: 'home' },
    { to: '/leads', label: 'Tashqi xaridorlar', icon: 'globe' },
  ],
}

function initials(name = '') {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV[user.role] || NAV.exporter
  const roleColor = `var(--role-${user.role})`

  return (
    <div className="shell">
      <header className="shell-topbar">
        <div className="brand">
          <span className="brand-mark" />
          Ipak Yo'li
        </div>
        <div className="row center" style={{ gap: '1rem' }}>
          <div className="user-chip">
            <div className="user-avatar" style={{ background: roleColor }}>{initials(user.name)}</div>
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login') }}>
            Chiqish
          </button>
        </div>
      </header>

      <aside className="shell-side">
        {items.map((it, i) =>
          it.section ? (
            <div className="nav-section" key={'s' + i}>{it.section}</div>
          ) : (
            <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon name={it.icon} />
              {it.label}
            </NavLink>
          )
        )}
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
