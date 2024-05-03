import { Link } from "react-router-dom";

export default function Header() {
  return (
    <div>
      <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between h-20 bg-gray-900 text-white max-w-6xl mx-auto">
        <Link to={"/"}>
          <div className="ml-5">
            <h1 className="text-purple-900 font-bold text-xl sm:text-2xl md:text-3xl cursor-pointer tracking-wide">
              AttendEase
            </h1>
          </div>
        </Link>
        <ul className="flex list-none items-center space-x-6 text-gray-300 font-semibold">
          <li>
            <Link to={"/"} className="hover:text-gray-100">
              Home
            </Link>
          </li>
          <li>
            <Link to={'/ticket'} className="hover:text-gray-100">
              Raise Ticket
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
