import {
  ReactNode,
  InputHTMLAttributes,
  ButtonHTMLAttributes
} from 'react';


// =====================================================
// BUTTON
// =====================================================

export const Button = ({
  variant = 'primary',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) => {

  const styles = {
    primary:
      'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',

    ghost:
      'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',

    danger:
      'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  };

  return (
    <button
      {...p}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-xl
        px-4
        py-2.5
        text-sm
        font-semibold
        transition-all
        duration-200
        disabled:cursor-not-allowed
        disabled:opacity-50
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-emerald-500
        ${styles[variant]}
        ${p.className ?? ''}
      `}
    />
  );
};


// =====================================================
// INPUT
// =====================================================

export const Input = ({
  label,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) => (
  <label className="block text-sm">

    <span className="mb-2 block font-medium text-stone-700">
      {label}
    </span>

    <input
      {...p}
      className={`
        w-full
        rounded-xl
        border
        border-stone-200
        bg-white
        px-3.5
        py-2.5
        text-sm
        text-stone-900
        shadow-sm
        outline-none
        transition
        placeholder:text-stone-400
        focus:border-emerald-500
        focus:ring-4
        focus:ring-emerald-500/10
        ${p.className ?? ''}
      `}
    />

  </label>
);


// =====================================================
// MODAL
// =====================================================

export const Modal = ({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (

  <div
    className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-stone-950/50
      p-4
      backdrop-blur-sm
    "
    onClick={onClose}
  >

    <div
      className="
        max-h-[90vh]
        w-full
        max-w-xl
        overflow-auto
        rounded-2xl
        border
        border-stone-200
        bg-white
        shadow-2xl
      "
      onClick={e => e.stopPropagation()}
    >

      <div
        className="
          sticky
          top-0
          z-10
          flex
          items-center
          justify-between
          border-b
          border-stone-100
          bg-white
          px-6
          py-5
        "
      >

        <div>
          <h2 className="text-lg font-bold text-stone-900">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-stone-500">
            Create and schedule your email campaign
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            text-xl
            text-stone-400
            transition
            hover:bg-stone-100
            hover:text-stone-700
          "
        >
          ×
        </button>

      </div>

      <div className="p-6">
        {children}
      </div>

    </div>

  </div>
);


// =====================================================
// TABLE
// =====================================================

export function Table<T extends { id: number }>({
  rows,
  loading,
  empty,
  cols
}: {
  rows: T[];
  loading: boolean;
  empty: string;
  cols: {
    head: string;
    cell: (r: T) => ReactNode;
  }[];
}) {

  if (loading) {

    return (
      <div className="flex flex-col items-center justify-center p-12">

        <div
          className="
            h-8
            w-8
            animate-spin
            rounded-full
            border-2
            border-stone-200
            border-t-emerald-600
          "
        />

        <p className="mt-3 text-sm text-stone-500">
          Loading emails...
        </p>

      </div>
    );

  }


  if (!rows.length) {

    return (
      <div className="flex flex-col items-center justify-center p-14 text-center">

        <div
          className="
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-2xl
            bg-emerald-50
            text-2xl
          "
        >
          ✉
        </div>

        <p className="mt-4 font-semibold text-stone-800">
          {empty}
        </p>

        <p className="mt-1 max-w-sm text-sm text-stone-500">
          Your email activity will appear here once you
          schedule or send an email.
        </p>

      </div>
    );

  }


  return (

    <div className="overflow-x-auto">

      <table className="w-full text-left text-sm">

        <thead className="border-b border-stone-100 bg-stone-50/70">

          <tr>

            {cols.map(c => (

              <th
                key={c.head}
                className="
                  whitespace-nowrap
                  px-5
                  py-3.5
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-stone-500
                "
              >
                {c.head}
              </th>

            ))}

          </tr>

        </thead>


        <tbody>

          {rows.map(r => (

            <tr
              key={r.id}
              className="
                border-b
                border-stone-100
                transition
                last:border-0
                hover:bg-stone-50/70
              "
            >

              {cols.map(c => (

                <td
                  key={c.head}
                  className="whitespace-nowrap px-5 py-4"
                >
                  {c.cell(r)}
                </td>

              ))}

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );
}