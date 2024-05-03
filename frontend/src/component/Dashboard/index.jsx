import Header from "../header";

export default function Dashboard() {
    return (
        <div>
            <Header />
            <div className="bg-gray-900 text-white">
                <div className="h-screen flex flex-col justify-center items-center">
                    <h1 className="text-3xl font-bold mt-8 mb-8">Dashboard</h1>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead>
                                <tr>
                                    <th className="border border-gray-700 px-4 py-2">Ticket Number</th>
                                    <th className="border border-gray-700 px-4 py-2">Response</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Table rows will be dynamically generated here */}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
