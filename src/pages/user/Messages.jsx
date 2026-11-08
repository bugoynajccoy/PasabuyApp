import UnreadBadge from '../../components/UnreadBadge.jsx'
import { Link } from 'react-router-dom'
import { useComposer } from '../../components/PostComposer.jsx'
import MessageList from '../../components/MessageList.jsx'
import ActivityCanvas from '../../components/ActivityCanvas.jsx'

// Real conversation list (live). Layout is the original message.html markup.
export default function Messages() {
  const { openComposer } = useComposer()
  return (
    <>
<nav className="navbar navbar-expand-lg bg-white text-black d-lg-none sticky-top" style={{borderBottom:'2px solid rgba(128, 128, 128, 0.13)'}}>{' '}<div className="container">{' '}<h3 className="fw-bold p-2 navbar-brand text-black">{' '}Messages{' '}<span className="text-warning">.</span>{' '}</h3>{' '}<ul className="navbar-nav"><div className="d-flex flex-row">{' '}<li className="nav-item px-2">{' '}<Link to="/notifications" className="nav-link text-black position-relative" aria-label="Notifications">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-bell`} />{' '}</svg><UnreadBadge kind="notifications" />{' '}</Link>{' '}</li></div></ul>{' '}</div>{' '}</nav>
<div className="container-fluid p-0">
  <MessageList />
</div>
<ActivityCanvas />
<nav className="navbar navbar-expand-lg bg-white sticky-bottom d-lg-none py-0" style={{borderTop:'2px solid rgba(128, 128, 128, 0.13)'}}>{' '}<div className="container">{' '}<ul className="navbar-nav w-100"><div className="d-flex justify-content-around align-items-center">{' '}<li className="nav-item">{' '}<Link to="/" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-house-door`} />{' '}</svg>{' '}<span><small>Home</small></span>{' '}</Link>{' '}</li>{' '}<li className="nav-item">{' '}<a href="#search" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center" data-bs-target="#SearchCanvas" data-bs-toggle="offcanvas">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-search`} />{' '}</svg>{' '}<span><small>Search</small></span>{' '}</a>{' '}</li>{' '}<li className="nav-item d-flex align-items-center justify-content-center bg-warning-subtle rounded-4" style={{width:'50px',height:'50px'}}>{' '}<button type="button" onClick={openComposer} aria-label="New post" className="nav-link text-warning d-flex flex-column justify-content-center align-items-center">{' '}<svg className="bi bi-lg align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-plus-square`} />{' '}</svg>{' '}</button>{' '}</li>{' '}<li className="nav-item">{' '}<Link to="/messages" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center position-relative" aria-label="Messages">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-chat`} />{' '}</svg><UnreadBadge kind="messages" />{' '}<span><small>Messages</small></span>{' '}</Link>{' '}</li>{' '}<li className="nav-item">{' '}<Link to="/profile" className="nav-link text-secondary d-flex flex-column justify-content-center align-items-center" type="button">{' '}<svg className="bi bi-md align-middle">{' '}<use href={`${import.meta.env.BASE_URL}instagram-icons/sprite.svg#bi-person-circle`} />{' '}</svg>{' '}<span><small>Profile</small></span>{' '}</Link>{' '}</li>{' '}</div></ul>{' '}</div>{' '}</nav>
    </>
  )
}
