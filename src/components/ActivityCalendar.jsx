import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getDay,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip } from "react-tooltip";

export function ActivityCalendar({ year, data, view = "year", onDayClick }) {
  const today = new Date();

  let startDate, endDate;

  switch (view) {
    case "week":
      startDate = startOfWeek(today, { locale: ptBR });
      endDate = endOfWeek(today, { locale: ptBR });
      break;
    case "month":
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      break;
    case "year":
    default:
      startDate = startOfYear(new Date(year, 0, 1));
      endDate = endOfYear(new Date(year, 11, 31));
      break;
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const dataMap = new Map(
    data.map((item) => {
      const date = new Date(item.study_date + "T00:00:00");
      return [format(date, "yyyy-MM-dd"), item.count];
    })
  );

  const getDayColor = (count) => {
    if (count === 0) return "bg-gray-200 dark:bg-gray-700/50";
    if (count <= 2) return "bg-green-200 dark:bg-green-900";
    if (count <= 5) return "bg-green-400 dark:bg-green-700";
    if (count <= 10) return "bg-green-600 dark:bg-green-500";
    return "bg-green-800 dark:bg-green-300";
  };

  const WeekdayLabels = ({ className = "" }) => (
    <div
      className={`grid grid-cols-7 gap-1 text-xs text-center text-gray-500 dark:text-gray-400 ${className}`}
    >
      {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
        <div key={i}>{day}</div>
      ))}
    </div>
  );

  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStart = new Date(year, i, 1);
      const monthEnd = endOfMonth(monthStart);
      const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: monthEnd,
      });
      const firstDayOfMonth = getDay(monthStart);

      return (
        <div key={i}>
          <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            {format(monthStart, "MMM", { locale: ptBR })}
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${i}-${idx}`} />
            ))}
            {daysInMonth.map((day) => {
              const formattedDate = format(day, "yyyy-MM-dd");
              const count = dataMap.get(formattedDate) || 0;
              const isClickable = count > 0;
              return (
                <button
                  key={formattedDate}
                  disabled={!isClickable}
                  onClick={() => isClickable && onDayClick(day)}
                  data-tooltip-id="activity-tooltip"
                  data-tooltip-content={`${count} sessões em ${format(
                    day,
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )}`}
                  className={`w-full aspect-square rounded-sm flex items-center justify-center transition-all ${getDayColor(
                    count
                  )} ${
                    isClickable
                      ? "cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-800 hover:ring-blue-400"
                      : ""
                  }`}
                >
                  <span className="text-gray-800 dark:text-gray-200 text-[10px]">
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    });

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-4">
        {months}
      </div>
    );
  };

  const renderMonthView = () => {
    const firstDayOfMonth = getDay(startDate);

    return (
      <div className="max-w-md mx-auto">
        <WeekdayLabels className="mb-2" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
            <div key={`empty-${idx}`} />
          ))}
          {days.map((day) => {
            const formattedDate = format(day, "yyyy-MM-dd");
            const count = dataMap.get(formattedDate) || 0;
            const isCurrentMonth = isSameMonth(day, today);
            const isClickable = count > 0;
            return (
              <button
                key={formattedDate}
                disabled={!isClickable}
                onClick={() => isClickable && onDayClick(day)}
                data-tooltip-id="activity-tooltip"
                data-tooltip-content={`${count} sessões em ${format(
                  day,
                  "dd/MM/yyyy",
                  { locale: ptBR }
                )}`}
                className={`w-full aspect-square rounded-md flex items-center justify-center transition-all ${getDayColor(
                  count
                )} ${isSameDay(day, today) ? "ring-2 ring-blue-500" : ""} ${
                  !isCurrentMonth ? "opacity-40" : ""
                } ${
                  isClickable
                    ? "cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-800 hover:ring-blue-400"
                    : ""
                }`}
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    return (
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const formattedDate = format(day, "yyyy-MM-dd");
            const count = dataMap.get(formattedDate) || 0;
            const isClickable = count > 0;
            return (
              <div key={formattedDate} className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <button
                  disabled={!isClickable}
                  onClick={() => isClickable && onDayClick(day)}
                  data-tooltip-id="activity-tooltip"
                  data-tooltip-content={`${count} sessões em ${format(
                    day,
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )}`}
                  className={`w-full aspect-square rounded-md flex items-center justify-center transition-all ${getDayColor(
                    count
                  )} ${isSameDay(day, today) ? "ring-2 ring-blue-500" : ""} ${
                    isClickable
                      ? "cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-800 hover:ring-blue-400"
                      : ""
                  }`}
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {format(day, "d")}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      {view === "year" && renderYearView()}
      {view === "month" && renderMonthView()}
      {view === "week" && renderWeekView()}
      <Tooltip
        id="activity-tooltip"
        style={{
          backgroundColor: "var(--tooltip-bg, #1f2937)",
          color: "var(--tooltip-color, #f9fafb)",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "12px",
        }}
      />
    </div>
  );
}
